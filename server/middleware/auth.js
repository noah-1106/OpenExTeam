/**
 * API 鉴权中间件
 *
 * 通过环境变量 OPENEXTEAM_API_KEY 启用鉴权。
 * 未设置时所有请求不受限（向后兼容）。
 * 设置后，所有 /api/ 请求需携带 Authorization: Bearer <key> 头部。
 */

const API_KEY = process.env.OPENEXTEAM_API_KEY;

function apiKeyAuth(req, res, next) {
  if (!API_KEY) return next();

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (token === API_KEY) return next();

  res.status(401).json({ success: false, message: 'Unauthorized: invalid or missing API key' });
}

module.exports = { apiKeyAuth };
