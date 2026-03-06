const router = require('express').Router();
const { createPage, getPage } = require('../controllers/page.controller');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/', protect, adminOnly, createPage);
router.get('/:slug', getPage);

module.exports = router;