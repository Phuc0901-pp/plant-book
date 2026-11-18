module.exports = function checkTier(requiredTier = 'pro') {
  return (req, res, next) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Chưa xác thực đăng nhập.' });
    }

    if (user.role === 'admin') {
      return next();
    }

    const currentTier = user.account_tier || 'normal';

    if (currentTier === 'pro' && user.tier_expires_at) {
      const expiresDate = new Date(user.tier_expires_at);
      if (expiresDate < new Date()) {
        return res.status(403).json({
          error: 'Gói PRO của bạn đã hết hạn. Vui lòng liên hệ Admin Mr. Phúc (0908904895) để gia hạn!',
          code: 'TIER_EXPIRED',
          expires_at: user.tier_expires_at
        });
      }
    }

    if (requiredTier === 'pro' && currentTier !== 'pro') {
      return res.status(403).json({
        error: 'Tính năng này chỉ dành cho Nông hộ gói PRO. Vui lòng nâng cấp gói cước để tiếp tục sử dụng!',
        code: 'PRO_TIER_REQUIRED'
      });
    }

    next();
  };
};
