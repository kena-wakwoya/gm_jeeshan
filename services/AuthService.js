const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');    
const { User } = require('../models');   
const AppError = require('../utils/AppError');

class AuthService {
  constructor() {
    this.jwtSecret   = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '12h';

    if (!this.jwtSecret) {
      // Fail fast in production
      throw new Error('JWT_SECRET is not set. Refusing to start for security reasons.');
    }
  }


  async login(email, password) {
    const user = await User.findOne({ where: { email } });
    if (!user) throw new AppError('Incorrect email or password.', 401);

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new AppError('Incorrect email or password.', 401);

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn, algorithm: 'HS256' }
    );
    

    return {token,user};
  }


  async verifyToken(token) {
    let decoded;
    try {
      decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError)
        throw new AppError('Your token has expired. Please log in again.', 401);
      if (err instanceof jwt.JsonWebTokenError)
        throw new AppError('Invalid token. Please log in again.', 401);
      throw new AppError(`Authentication error: ${err.message}`, 401);
    }

    const currentUser = await User.findByPk(decoded.sub);
    if (!currentUser)
      throw new AppError('The user belonging to this token no longer exists.', 401);

    return currentUser;       
  }
  
}

module.exports = new AuthService();
