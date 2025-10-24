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
import adminFetchQuotes from './adminFetchQuotes.js';
import decisionLogic from './decisionLogic.js';
import adminFetchOrders from './adminFetchOrders.js';
import orderPayment from './orderPayment.js';
import fetchInvoice from './fetchInvoice.js';
import salespeopleDetails from './salespeopleDetails.js';
import adminQuotespending from './adminQuotespending.js';

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
app.get('/api/admin/quotes',async (req,res)=>{
  res.set('Cache-Control', 'no-store');
  await adminFetchQuotes(pool,res);
});


app.get('/api/admin/quotes/pending', async (req, res) => {
  await adminQuotespending(pool,res);
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
  await salespeopleDetails(pool,res);
 });

app.get('/api/sales-person/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT o.order_id, o.quote_number, o.total_price, o.status
       FROM orders o
       JOIN quotes q ON o.quote_number = q.quote_number
       WHERE q.sales_person_id = $1
       ORDER BY o.order_id DESC`,
      [userId]
    );
    res.json({ orders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});
// GET all addresses for a salesperson
app.get('/api/sales-person/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT address_id, street, city, pincode 
       FROM address_details 
       WHERE user_id = $1`,
      [userId]
    );
    res.status(200).json({ addresses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch addresses" });
  }
});

app.listen(5000, () => {
  console.log("Server is running on http://localhost:5000");
});