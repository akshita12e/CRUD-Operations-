const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON data
app.use(express.json());

// Database connection setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Function to create tables if they don't exist
const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Customers (
        CustomerID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        FirstName VARCHAR NOT NULL,
        LastName VARCHAR NOT NULL,
        PhoneNumber VARCHAR NOT NULL,
        City VARCHAR NOT NULL,
        State VARCHAR NOT NULL,
        PinCode VARCHAR NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS Addresses (
        AddressID UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        CustomerID UUID REFERENCES Customers(CustomerID),
        AddressLine VARCHAR NOT NULL,
        City VARCHAR NOT NULL,
        State VARCHAR NOT NULL,
        PinCode VARCHAR NOT NULL
      );
    `);

    console.log('Tables initialized');
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
};

// Invoke the table creation function
initTables();

// Endpoint to create a new customer
app.post('/customers', async (req, res) => {
  const { FirstName, LastName, PhoneNumber, City, State, PinCode } = req.body;
  try {
    const queryResult = await pool.query(
      `INSERT INTO Customers (FirstName, LastName, PhoneNumber, City, State, PinCode)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [FirstName, LastName, PhoneNumber, City, State, PinCode]
    );
    res.status(201).json(queryResult.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Retrieve customer details by ID
app.get('/customers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const queryResult = await pool.query('SELECT * FROM Customers WHERE CustomerID = $1', [id]);
    if (queryResult.rows.length > 0) {
      res.json(queryResult.rows[0]);
    } else {
      res.status(404).json({ error: 'Customer not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving customer details' });
  }
});

// Update customer information
app.put('/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { FirstName, LastName, PhoneNumber } = req.body;
  try {
    const queryResult = await pool.query(
      `UPDATE Customers SET FirstName = $1, LastName = $2, PhoneNumber = $3 WHERE CustomerID = $4 RETURNING *`,
      [FirstName, LastName, PhoneNumber, id]
    );
    res.json(queryResult.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer information' });
  }
});

// Delete a customer record
app.delete('/customers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM Customers WHERE CustomerID = $1', [id]);
    res.json({ message: 'Customer successfully deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting customer' });
  }
});

// Retrieve multiple addresses by customer ID
app.get('/customers/:id/addresses', async (req, res) => {
  const { id } = req.params;
  try {
    const queryResult = await pool.query('SELECT * FROM Addresses WHERE CustomerID = $1', [id]);
    res.json(queryResult.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching addresses' });
  }
});

// Update multiple addresses
app.put('/addresses/:id', async (req, res) => {
  const { id } = req.params;
  const { AddressLine, City, State, PinCode } = req.body;
  try {
    const queryResult = await pool.query(
      `UPDATE Addresses SET AddressLine = $1, City = $2, State = $3, PinCode = $4 WHERE AddressID = $5 RETURNING *`,
      [AddressLine, City, State, PinCode, id]
    );
    res.json(queryResult.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error updating address' });
  }
});

// Customers with only one address
app.get('/customers/one-address', async (req, res) => {
  try {
    const queryResult = await pool.query(`
      SELECT c.CustomerID, c.FirstName, c.LastName
      FROM Customers c
      LEFT JOIN Addresses a ON c.CustomerID = a.CustomerID
      GROUP BY c.CustomerID, c.FirstName, c.LastName
      HAVING COUNT(a.AddressID) = 1;
    `);
    res.json(queryResult.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching customers with one address' });
  }
});

// Search customers by City, State, or PinCode
app.get('/customers/search', async (req, res) => {
  const { City, State, PinCode } = req.query;
  try {
    let baseQuery = 'SELECT * FROM Customers WHERE 1=1';
    const parameters = [];

    if (City) {
      parameters.push(City);
      baseQuery += ` AND City = $${parameters.length}`;
    }
    if (State) {
      parameters.push(State);
      baseQuery += ` AND State = $${parameters.length}`;
    }
    if (PinCode) {
      parameters.push(PinCode);
      baseQuery += ` AND PinCode = $${parameters.length}`;
    }

    const queryResult = await pool.query(baseQuery, parameters);
    res.json(queryResult.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error searching customers' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
