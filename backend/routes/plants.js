// Modular Plant & NFC Router Aggregator (Enterprise ISO Architecture)
const express = require('express');
const router = express.Router();

router.use('/', require('./plants/core.routes'));
router.use('/', require('./plants/nfc.routes'));
router.use('/', require('./plants/media-logs.routes'));
router.use('/', require('./plants/public.routes'));

module.exports = router;
