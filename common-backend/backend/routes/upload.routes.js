const router = require('express').Router();
const { uploadImage } = require('../controllers/upload.controller');
const upload = require('../middleware/upload.middleware');
const { protect, adminOnly } = require('../middleware/auth.middleware');

router.post('/', protect, adminOnly, upload.single('image'), uploadImage);

module.exports = router;
