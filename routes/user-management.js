const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUser,
  createUser, 
  updateUser,
  deleteUser,
} = require('../controller/user-management');

router.route('/')
  .get(getAllUsers)
  .post(createUser);

router.route('/:targetUserId')
  .get(getUser)
  .patch(updateUser)
  .delete(deleteUser); 

module.exports = router;