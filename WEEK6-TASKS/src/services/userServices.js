const User = require('../models/userModel');

const createUser = async (username, password) => {
  const user = new User({
    username,
    password,
  });
  
  await user.save();
  return user;
};

module.exports = { createUser };
