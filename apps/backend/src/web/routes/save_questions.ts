// Importing required modules
import { Router } from "express";              // Express router to define route handlers
import { MongoClient } from "mongodb";         // MongoDB client for database operations

const router = Router();                       // Initialize a new Express Router
const mongoURL = "mongodb://localhost:27017";  // MongoDB connection URL (local instance)
const client = new MongoClient(mongoURL);      // Create a MongoClient instance

// Route to handle saving multiple questions to the MongoDB database
router.post("/save_questions", async (req, res) => {
  const data = req.body;                       // Extract JSON data from the request body

  try {
    await client.connect();                    // Connect to MongoDB
    const db = client.db("polls");             // Use (or create) the 'polls' database
    const collection = db.collection("questions"); // Access (or create) the 'questions' collection

    await collection.insertMany(data);         // Insert received questions as an array
    res.json({ message: "Questions saved to DB" }); // Send success response
  } catch (err) {
    console.error(err);                        // Log error if insertion fails
    res.status(500).json({ message: "DB error" });  // Respond with 500 if there's a DB error
  } finally {
    await client.close();                      // Always close DB connection after operation
  }
});

// Export the router so it can be used in main server file
export default router;
