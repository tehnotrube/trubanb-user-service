// Set environment variables BEFORE anything is loaded
if (!process.env.RABBITMQ_URL) {
  process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
}
process.env.NODE_ENV = 'test';

