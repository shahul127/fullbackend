import { hash } from 'bcrypt';

async function registerUser(pool, formData, res) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const hashedPassword = await hash(formData.password, 10);

        const existing = await client.query('SELECT * FROM sales_person WHERE email_id = $1', [formData.emailId]);
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }

        const userQuery = `INSERT INTO sales_person (name, email_id, password) VALUES ($1, $2, $3) RETURNING user_id`;
        const result = await client.query(userQuery, [formData.name, formData.emailId, hashedPassword]);

        const userId = result.rows[0].user_id;

        const contactQuery = `INSERT INTO contact_details (user_id, contact_number) VALUES ($1, $2)`;
        for (const contact of formData.contacts)
            await client.query(contactQuery, [userId, contact]);

        const addressQuery = `INSERT INTO address_details (user_id, street, city, pincode) VALUES ($1, $2, $3, $4)`;
        for (const address of formData.addresses)
            await client.query(addressQuery, [userId, address.street, address.city, address.pincode]);

        await client.query('COMMIT');
        console.log('Registration Completed!');
        return res.status(201).json({ userId, success: true, message: 'User created!' });
    }

    catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        return res.status(500).json({ message: 'Database Error' });
    }

    finally {
        client.release();
    }
}

export default registerUser;