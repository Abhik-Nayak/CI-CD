const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const taskController = require('../controllers/taskController');

const taskValidation = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('status').optional().isIn(['pending', 'in_progress', 'completed']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
];

router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', taskValidation, taskController.createTask);
router.put('/:id', taskValidation, taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
