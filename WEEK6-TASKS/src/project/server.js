const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.log(err));


const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'instructor'], required: true }
});

const User = mongoose.model('User', userSchema);

// Course Schema & Model
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  instructorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const Course = mongoose.model('Course', courseSchema);

// Constants
const SECRET_KEY = process.env.JWT_SECRET || 'supersecretkey';

// Helper Functions
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
}

function authenticateToken(req, res, next) {
  const token = req.header('Authorization');
  if (!token) return res.status(403).send('Access Denied');

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).send('Invalid Token');
    req.user = user;
    next();
  });
}

// Routes

// 1. User Registration
app.post('/signup', async (req, res) => {
  const { email, password, role } = req.body;
  
  // Validate input
  if (!email || !password || !role) {
    return res.status(400).send('Please provide email, password, and role.');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).send('User already exists.');
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new user
  const user = new User({ email, password: hashedPassword, role });
  await user.save();

  // Return a success message
  res.status(201).send({ message: 'User created successfully' });
});

// 2. User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find the user by email
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found.');

  // Check if password matches
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) return res.status(400).send('Invalid credentials.');

  // Generate JWT token
  const token = generateToken(user);
  
  // Return the token
  res.status(200).send({ token });
});

// 3. Get User Profile (Authenticated Route)
app.get('/profile', authenticateToken, (req, res) => {
  res.status(200).send({ message: 'Welcome to your profile', user: req.user });
});

// 4. Create Course (Instructor Only)
app.post('/course', authenticateToken, async (req, res) => {
  if (req.user.role !== 'instructor') {
    return res.status(403).send('Access denied. Only instructors can create courses.');
  }

  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).send('Course title and description are required.');
  }

  const course = new Course({
    title,
    description,
    instructorId: req.user.id
  });
  await course.save();

  res.status(201).send({ message: 'Course created successfully', course });
});

// 5. Get All Courses (Accessible by Students and Instructors)
app.get('/courses', async (req, res) => {
  const courses = await Course.find().populate('instructorId', 'email role');
  res.status(200).send({ courses });
});

// 6. Enroll in Course (Student Only)
app.post('/enroll', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).send('Access denied. Only students can enroll in courses.');
  }

  const { courseId } = req.body;
  const course = await Course.findById(courseId);

  if (!course) {
    return res.status(404).send('Course not found.');
  }

  if (!course.students.includes(req.user.id)) {
    course.students.push(req.user.id);
    await course.save();
    res.status(200).send({ message: 'Enrolled in course successfully' });
  } else {
    res.status(400).send('Already enrolled in this course');
  }
});

// 7. Logout (Simply Client-Side)
app.post('/logout', authenticateToken, (req, res) => {
 res.status(200).send({ message: 'Logged out successfully' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
