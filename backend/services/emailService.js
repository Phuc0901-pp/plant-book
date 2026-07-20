const nodemailer = require('nodemailer');
require('dotenv').config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'phphuc0539@gmail.com';

// Configure transporter with fallback credentials & socket timeouts
function createTransporter() {
  const user = process.env.SMTP_USER || 'phphuc0539@gmail.com';
  const pass = process.env.SMTP_PASS || '090103Phuc@';

  if (user && pass) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      connectionTimeout: 5000, // 5s timeout to prevent hanging
      greetingTimeout: 5000,
      socketTimeout: 5000,
      auth: { user, pass },
    });
  }
  return null;
}

/**
 * Send password reset request notification to Admin email (phphuc0539@gmail.com)
 */
async function sendAdminResetNotification({ user, requestToken, baseUrl, note }) {
  const approveUrl = `${baseUrl}/api/auth/approve-reset-password?token=${requestToken}`;
  const rejectUrl = `${baseUrl}/api/auth/reject-reset-password?token=${requestToken}`;

  const html = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #1b4d3e 0%, #22c55e 100%); padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Hệ Thống Quản Lý Cây Trồng - Tanbao AgTech</h1>
        <p style="color: #e2e8f0; margin: 6px 0 0 0; font-size: 14px;">Yêu cầu cấp lại mật khẩu từ khách hàng</p>
      </div>

      <div style="padding: 28px;">
        <div style="background-color: #f8fafc; border-left: 4px solid #22c55e; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">Thông tin tài khoản yêu cầu:</h3>
          <p style="margin: 4px 0; color: #475569; font-size: 14px;"><strong>Họ và tên:</strong> ${user.full_name || user.name || 'Khách hàng'}</p>
          <p style="margin: 4px 0; color: #475569; font-size: 14px;"><strong>Email:</strong> ${user.email}</p>
          <p style="margin: 4px 0; color: #475569; font-size: 14px;"><strong>Số điện thoại:</strong> ${user.phone || 'Chưa cập nhật'}</p>
          <p style="margin: 4px 0; color: #475569; font-size: 14px;"><strong>Thời gian gửi:</strong> ${new Date().toLocaleString('vi-VN')}</p>
          ${note ? `<p style="margin: 8px 0 0 0; color: #0f172a; font-size: 14px; font-style: italic;"><strong>Ghi chú từ khách:</strong> "${note}"</p>` : ''}
        </div>

        <p style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Vui lòng bấm nút bên dưới để <strong>Phê duyệt & Tự động cấp mật khẩu mới</strong> cho khách hàng. Hệ thống sẽ tạo mật khẩu mới an toàn và gửi về cho khách hàng ngay lập tức.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${approveUrl}" style="background-color: #22c55e; color: #ffffff; font-weight: bold; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(34,197,94,0.35);">
            ✓ PHÊ DUYỆT & CẤP MẬT KHẨU MỚI
          </a>
        </div>

        <div style="text-align: center; margin-top: 16px;">
          <a href="${rejectUrl}" style="color: #ef4444; font-size: 13px; text-decoration: underline;">Từ chối yêu cầu này</a>
        </div>
      </div>

      <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Email này được gửi tự động từ hệ thống Tanbao AgTech. Vui lòng không trả lời trực tiếp email này.
      </div>
    </div>
  `;

  console.log('\n======================================================');
  console.log(`✉️ EMAIL DUYỆT CẤP MẬT KHẨU ĐẾN ADMIN (${ADMIN_EMAIL}):`);
  console.log(`👉 ĐƯỜNG DẪN DUYỆT 1-CLICK: ${approveUrl}`);
  console.log('======================================================\n');

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Tanbao AgTech System" <${process.env.SMTP_USER}>`,
        to: ADMIN_EMAIL,
        subject: `[Yêu cầu cấp lại mật khẩu] Tài khoản: ${user.email}`,
        html,
      });
      console.log(`✅ Đã gửi email thông báo phê duyệt tới Admin (${ADMIN_EMAIL}) thành công!`);
    } catch (err) {
      console.error('⚠️ Lỗi gửi mail qua SMTP:', err.message);
    }
  }
}

/**
 * Send new password notification email to customer
 */
async function sendCustomerNewPassword({ user, newPassword }) {
  const html = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #1b4d3e 0%, #22c55e 100%); padding: 24px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Tanbao AgTech - Thông báo Cấp lại Mật khẩu</h1>
      </div>

      <div style="padding: 28px;">
        <p style="color: #1e293b; font-size: 15px;">Kính gửi <strong>${user.full_name || user.name || 'Quý khách hàng'}</strong>,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Yêu cầu cấp lại mật khẩu cho tài khoản <strong>${user.email}</strong> của bạn đã được Ban Quản trị xét duyệt và phê duyệt thành công.
        </p>

        <div style="background-color: #f0fdf4; border: 1.5px dashed #22c55e; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <div style="font-size: 13px; color: #166534; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Mật khẩu mới của bạn:</div>
          <div style="font-size: 24px; font-family: monospace; font-weight: bold; color: #15803d; letter-spacing: 2px;">${newPassword}</div>
        </div>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          * Vì lý do bảo mật, vui lòng đăng nhập vào ứng dụng và đổi lại mật khẩu mới trong phần <strong>Cài đặt tài khoản</strong> ngay sau khi đăng nhập thành công.
        </p>
      </div>
    </div>
  `;

  console.log('\n======================================================');
  console.log(`✉️ GỬI MẬT KHẨU MỚI CHO KHÁCH HÀNG (${user.email}):`);
  console.log(`🔑 MẬT KHẨU MỚI: ${newPassword}`);
  console.log('======================================================\n');

  const transporter = createTransporter();
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Tanbao AgTech Support" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: `[Tanbao AgTech] Thông báo cấp lại mật khẩu tài khoản ${user.email}`,
        html,
      });
      console.log(`✅ Đã gửi mail chứa mật khẩu mới đến khách hàng (${user.email})!`);
    } catch (err) {
      console.error('⚠️ Lỗi gửi mail tới khách hàng:', err.message);
    }
  }
}

module.exports = {
  sendAdminResetNotification,
  sendCustomerNewPassword,
};
