const jwt = require("jsonwebtoken");
const createHttpError = require("http-errors");
const config = require("../config/config");

const verifyToken = async (req, res, next) => {
  try {
    console.log("🟨 Cookies:", req.cookies);
    console.log("🟦 Headers:", req.headers);

    const token = req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];
    console.log("📦 Token recibido:", token);

    if (!token) {
      return next(createHttpError(401, "Access token is missing"));
    }

    const decoded = jwt.verify(token, config.accessTokenSecret);
    console.log("🔓 Token decodificado:", decoded);

    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.error("❌ Error verificando token:", error.message);
    return next(createHttpError(401, "Invalid or expired token"));
  }
};

module.exports = verifyToken;