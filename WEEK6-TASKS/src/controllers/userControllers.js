const userService = require('../services/userService');

// POST: Create a new user
const createUser = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await userService.createUser(username, password);
    res.status(201).json({
      message: 'User created successfully',
      user: {
        username: user.username,
      }
    });
  } catch (err) {
    res.status(400).json({ error: 'Error creating user', details: err.message });
  }
};

module.exports = { createUser };
