const jwt = require('jsonwebtoken');

/**
 * Broker Login Controller
 */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const expectedUsername = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Verify credentials
    if (username.trim() === expectedUsername && password.trim() === expectedPassword) {
      const token = jwt.sign(
        { username: expectedUsername, role: 'broker' },
        process.env.JWT_SECRET || 'vastu_rentals_jwt_secret_token_2026',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return res.json({
        token,
        user: {
          username: expectedUsername,
          role: 'broker',
          name: 'Broker'
        }
      });
    }

    return res.status(401).json({ error: "Invalid username or password." });
  } catch (error) {
    console.error("Login controller error:", error);
    return res.status(500).json({ error: "An unexpected error occurred during login." });
  }
};

/**
 * Verify current session token and return user info
 */
exports.verifySession = async (req, res) => {
  try {
    // req.user is set by authMiddleware
    return res.json({
      user: {
        username: req.user.username,
        role: req.user.role,
        name: 'Broker'
      }
    });
  } catch (error) {
    console.error("Verify session error:", error);
    return res.status(500).json({ error: "Failed to verify session." });
  }
};
