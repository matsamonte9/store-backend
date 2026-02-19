const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    minlength: [3, '"Name" must consist 3 characters'],
    maxlength: [50, '"Name" must be 50 characters only'],
    required: [true, '"Name" is required'],
  },
  role: {
    type: String,
    enum: ['cashier', 'inventory', 'admin'],
    default: 'cashier'
  },
  email: {
    type: String,
    required: [true, '"Email" is required'],
    match: [/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, '"Email" is invalid'],
    unique: true,
  },
  password: {
    type: String,
    required: [true, '"Password" is required'],
    minlength: [6, '"Password" must consist 6 characters'],
  },
});

UserSchema.pre('save', async function() {
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.createJWT = function() {
  return jwt.sign(
    { 
      userId: this._id, 
      name: this.name, 
      role: this.role 
    },
    process.env.JWT_KEY,
    { expiresIn: process.env.JWT_LIFETIME }
  );
}

UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', UserSchema);