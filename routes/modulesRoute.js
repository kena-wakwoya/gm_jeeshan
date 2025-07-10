const express = require('express');
const manageModulesController = require('../controllers/ModulesController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/', manageModulesController.getAllModules); 
router.get('/:id', manageModulesController.getModule); 
router.use(restrictTo('ADMIN'));

router.post('/', manageModulesController.addModule); 
router.delete('/:id', manageModulesController.deleteModule); 
router.put('/:id', manageModulesController.editModule); 

module.exports = router;