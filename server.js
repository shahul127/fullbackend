import express, { json } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { compare } from 'bcrypt';
import registerUser from './registerUser.js';
import changeRiceDetails from './changeRiceDetails.js';
import userDetails from './userDetails.js';
// import adminDetails from './adminDetails.js';
import quoteLogic from './quoteLogic.js';
// import adminFetchQuotes from './adminFetchQuotes.js';
import decisionLogic from './decisionLogic.js';
import adminFetchOrders from './adminFetchOrders.js';
import orderPayment from './orderPayment.js';
import fetchInvoice from './fetchInvoice.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
// const { Pool } = require("pg");

const pool = new Pool({ 
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "Benshaja@1427",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "project",
  port: process.env.DB_PORT || 5432,
});
const app = express();
app.use(json());
app.use(cors({ origin: "http://localhost:3000" }));

app.get('/', (req, res) => { res.send("Server is running"); })




app.post('/api/admin/login', (req, res) => {
  const { adminId, password } = req.body;

  if (adminId == process.env.OWNER_ID && password == process.env.OWNER_PASSWORD)
    return res.status(200).json({ success: true, message: "Admin login success!" });

  return res.status(400).json({ success: false, error: "Admin login failed!" });

});
app.get('/api/admin/revenue', async (req, res) => {
  try {
    const result = await pool.query('SELECT COALESCE(SUM(total_price), 0) AS "totalRevenue" FROM orders');
    res.status(200).json({ totalRevenue: parseFloat(result.rows[0].totalRevenue) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching total revenue' });
  }
});
app.get('/api/admin/orders/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) AS "totalOrders" FROM orders');
    res.status(200).json({ totalOrders: parseInt(result.rows[0].totalOrders, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching total orders' });
  }
});
app.get('/api/admin/salespeople/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) AS "totalSalespeople" FROM sales_person');
    res.status(200).json({ totalSalespeople: parseInt(result.rows[0].totalSalespeople, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching salespeople count' });
  }
});
app.get('/api/admin/quotes', async (req, res) => {
  try {
    const quotesResult = await pool.query(`
      SELECT 
        q.quote_number,
        q.sales_person_id,
        q.status,
        json_agg(
          json_build_object(
            'rice_name', r.rice_name,
            'quantity', qi.quantity,
            'quoted_price', qi.quoted_price
          )
        ) AS items,
        COALESCE(SUM(qi.quantity), 0) AS total_items,
        COALESCE(SUM(qi.quantity * qi.quoted_price), 0) AS total_price
      FROM quotes q
      LEFT JOIN quote_items qi ON q.quote_number = qi.quote_number
      LEFT JOIN rice_details r ON qi.rice_id = r.rice_id
      GROUP BY q.quote_number
      ORDER BY 
        CASE WHEN q.status = 'Pending' THEN 0 ELSE 1 END, 
        q.quote_number DESC
    `);

    res.status(200).json(quotesResult.rows);
  } catch (err) {
    console.error('Error fetching quotes:', err);
    res.status(500).json({ message: 'Error fetching quotes' });
  }
});

app.get('/api/admin/quotes/pending', async (req, res) => {
  try {
    const quotesResult = await pool.query(
      `SELECT q.quote_number, q.sales_person_id, s.name AS salesperson_name
       FROM quotes q
       JOIN sales_person s ON q.sales_person_id = s.user_id
       WHERE q.status='Pending'`
    );
    const quotes = quotesResult.rows;

    const quotesWithItems = await Promise.all(
      quotes.map(async (quote) => {
        const itemsResult = await pool.query(
          `SELECT qi.*, rd.rice_name 
           FROM quote_items qi 
           JOIN rice_details rd ON qi.rice_id = rd.rice_id
           WHERE qi.quote_number = $1`,
          [quote.quote_number]
        );

        return {
          quoteNumber: quote.quote_number,
          salespersonName: quote.salesperson_name,
          items: itemsResult.rows,
          totalPrice: itemsResult.rows.reduce((sum, i) => sum + i.quoted_price * i.quantity, 0)
        };
      })
    );

    res.status(200).json(quotesWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching pending quotes' });
  }
});


app.post('/api/sales-person/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM sales_person WHERE email_id = $1", [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: 'Salesperson not found' });

    const user = result.rows[0];
    const match = await compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, error: 'Password did not match' });

    res.status(200).json({ success: true, message: 'Login successful', userId: user.user_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

// Check if email exists
app.get('/api/check-email', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

  try {
    const result = await pool.query('SELECT * FROM sales_person WHERE email_id = $1', [email]);

    if (result.rows.length > 0) {
      // Email exists
      return res.status(200).json({ exists: true });
    } else {
      // Email does not exist
      return res.status(404).json({ exists: false, message: 'Email not found' });
    }
  } catch (err) {
    console.error('Error checking email:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});
//new the above one is

app.post('/api/sales-person/register', async (req, res) => {
  const formData = req.body;
  await registerUser(pool, formData, res);
});

app.get('/api/rice-varieties', async (req, res) => {
  try {
    const result = await pool.query('SELECT rice_id, rice_name, description, min_price, max_price FROM rice_details WHERE stock_available > 0')
    res.status(200).json(result.rows);
  }

  catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
})

app.post('/api/set-prices', async (req, res) => {
  const updates = req.body;
  await changeRiceDetails(pool, updates, res);
});

app.get('/api/sales-person/dashboard/:userId', async (req, res) => {
  const { userId } = req.params;
  await userDetails(pool, userId, res);
});

// app.get('/api/admin/dashboard', async (req, res) => {
//   await adminDetails(pool, res);
// });

app.post('/api/sales-person/:userId/quotes', async (req, res) => {
  const userId = req.params.userId;
  const quotedItems = req.body;
  await quoteLogic(pool, userId, quotedItems, res);
});
app.get('/api/admin/quotes', async (req, res) => {
  try {
    // 1️⃣ Get all quotes with totals
    const quotesRes = await pool.query(`
      SELECT 
        q.quote_number,
        q.sales_person_id,
        q.status,
        COALESCE(SUM(qi.quantity), 0) AS total_items,
        COALESCE(SUM(qi.quantity * qi.quoted_price), 0) AS total_price
      FROM quotes q
      LEFT JOIN quote_items qi ON q.quote_number = qi.quote_number
      GROUP BY q.quote_number
      ORDER BY CASE WHEN q.status='Pending' THEN 0 ELSE 1 END, q.quote_number DESC;
    `);

    const quotes = quotesRes.rows;

    // 2️⃣ Fetch items for each quote
    for (const quote of quotes) {
      const itemsRes = await pool.query(
        `SELECT qi.rice_id, r.rice_name, qi.quoted_price, qi.quantity
         FROM quote_items qi
         JOIN rice_details r ON qi.rice_id = r.rice_id
         WHERE qi.quote_number = $1`,
        [quote.quote_number]
      );
      quote.items = itemsRes.rows;  // Add items array to each quote
    }
console.log(quotes);
    res.status(200).json(quotes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch quotes' });
  }
});


app.post('/api/admin/quotes', async (req, res) => {
  const { action, quoteNumber } = req.body;
  await decisionLogic(pool, quoteNumber, action, res)
});

app.post('/api/sales-person/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  const { action, orderId, addressId } = req.body;
  await orderPayment(pool, userId, orderId, action, addressId, res);
});

app.get('/api/sales-person/:userId/:orderId/download', async (req, res) => {
  const { userId, orderId } = req.params;
  await fetchInvoice(pool, userId, orderId, res);
});

app.get('/api/admin/orders', async (req, res) => {
  const filterOption = req.query;
  await adminFetchOrders(pool, filterOption, res)
});
// GET /api/admin/salespeople
app.get('/api/admin/salespeople', async (req, res) => {
  try {
    // Fetch all salespeople
    const usersQuery = await pool.query('SELECT user_id, name, email_id FROM sales_person');
    const users = [];

    for (const row of usersQuery.rows) {
      const { user_id: userId, name, email_id: emailId } = row;

      // Contacts
      const contactRes = await pool.query(
        'SELECT contact_number FROM contact_details WHERE user_id = $1',
        [userId]
      );
      const contactNumbers = contactRes.rows.map(r => r.contact_number);

      // Addresses
      const addressRes = await pool.query(
        'SELECT street, city, pincode FROM address_details WHERE user_id = $1',
        [userId]
      );
      const addresses = addressRes.rows.map(r => ({
        street: r.street,
        city: r.city,
        pincode: r.pincode
      }));

      // Quotes
      const quoteQuery = `
        SELECT 
          q.quote_number,
          qi.rice_id,
          r.rice_name,
          qi.quoted_price,
          qi.quantity,
          q.status
        FROM quotes q
        JOIN quote_items qi ON q.quote_number = qi.quote_number
        JOIN rice_details r ON qi.rice_id = r.rice_id
        WHERE q.sales_person_id = $1
        ORDER BY q.quote_number;
      `;
      const quoteRes = await pool.query(quoteQuery, [userId]);
      const quotes = quoteRes.rows.map(row => ({
        quoteNumber: row.quote_number,
        riceId: row.rice_id,
        riceName: row.rice_name,
        quotedPrice: row.quoted_price,
        quantity: row.quantity,
        status: row.status
      }));

      // Orders
      const orderQuery = `
        SELECT 
          o.order_id,
          o.quote_number,
          o.total_price,
          o.status AS order_status,
          o.order_date,
          o.address_id,
          a.street,
          a.city,
          a.pincode,
          COUNT(qi.rice_id) AS item_count
        FROM orders o
        JOIN quotes q ON o.quote_number = q.quote_number
        JOIN quote_items qi ON q.quote_number = qi.quote_number
        LEFT JOIN address_details a ON o.address_id = a.address_id
        WHERE q.sales_person_id = $1
        GROUP BY o.order_id, o.quote_number, o.total_price, o.status, o.order_date,
                 o.address_id, a.street, a.city, a.pincode
        ORDER BY o.order_date DESC;
      `;
      const orderRes = await pool.query(orderQuery, [userId]);
      const orders = orderRes.rows.map(row => ({
        orderId: row.order_id,
        quoteNumber: row.quote_number,
        orderStatus: row.order_status,
        orderDate: row.order_date,
        itemCount: parseInt(row.item_count),
        totalPrice: parseFloat(row.total_price),
        address: row.address_id
          ? { street: row.street, city: row.city, pincode: row.pincode }
          : null
      }));

      users.push({ userId, name, emailId, contactNumbers, addresses, quotes, orders });
    }

    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to retrieve salespeople' });
  }
});


app.listen(5000, () => {
  console.log("Server is running on http://localhost:5000");
});