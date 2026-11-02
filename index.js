
import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

const app = express();

const PORT =  3000;

// Environment variables
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB = process.env.MONGO_DB || "edu_child";


if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in environment variables.");
}

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
});

// Database
const db = client.db(MONGO_DB);

// Collection
const upcommingCollection = db.collection("upcomming-events");

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:10000",
  })
);

app.use(express.json());




app.get("/", (req, res) => {
  res.send("Welcome to EduChild API!");
});




app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EduChild API is running successfully!",
  });
});




app.get("/api/health/db", async (req, res) => {
  try {
    const result = await db.command({ ping: 1 });

    res.status(200).json({
      success: true,
      message: "MongoDB connection is working",
      database: db.databaseName,
      ping: result.ok,
    });
  } catch (error) {
    console.error("Database health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});




app.get("/upcomming-events", async (req, res) => {
  try {
    const currentDate = new Date();
    const limit = req.query.limit
      ? Number(req.query.limit)
      : null;

    // Validate limit
    if (
      limit !== null &&
      (!Number.isInteger(limit) || limit < 1 || limit > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100",
      });
    }
    const pipeline = [
      {
        $addFields: {
          _eventDate: {
            $convert: {
              input: "$eventDate",
              to: "date",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $match: {
          _eventDate: {
            $gt: currentDate,
          },
        },
      },
      {
        $sort: {
          _eventDate: 1,
        },
      },
    ];

    if (limit !== null) {
      pipeline.push({
        $limit: limit,
      });
    }

   
    pipeline.push(
      {
        $set: {
          eventDate: "$_eventDate",
        },
      },
      {
        $unset: "_eventDate",
      }
    );

    
    const events = await upcommingCollection
      .aggregate(pipeline)
      .toArray();

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });

  } catch (error) {
    console.error("Upcoming events error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming events",
    });
  }
});



app.get("/upcomming-events/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    
    const event = await upcommingCollection.findOne({
      _id: new ObjectId(id),
    });

    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const normalizedEvent = {
      ...event,
      eventDate: event.eventDate
        ? new Date(event.eventDate)
        : null,
    };

    res.status(200).json({
      success: true,
      data: normalizedEvent,
    });

  } catch (error) {
    console.error("Single event error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch event",
    });
  }
});


async function startServer() {
  try {
    await client.connect();

    await db.command({ ping: 1 });

    console.log("You successfully connected to MongoDB!");
    console.log(`Database: ${MONGO_DB}`);

    app.listen(PORT, () => {
      console.log(`EduChild API running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Server startup failed:", error);

    await client.close().catch(() => {});

    process.exit(1);
  }
}

startServer();
