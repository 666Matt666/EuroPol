const { authenticateToken, authorizeAdmin, authorizeSupervisor } = require('./auth');
const jwt = 'jsonwebtoken'; // Usamos una cadena para evitar que Jest se confunda con el mock

// Mockeamos completamente el módulo 'jsonwebtoken'
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

describe('Auth Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;
  const mockJwt = require(jwt);

  beforeEach(() => {
    // Reseteamos los objetos mock antes de cada test
    mockRequest = {};
    mockResponse = {
      sendStatus: jest.fn(),
      status: jest.fn(() => mockResponse),
      json: jest.fn(),
    };
    nextFunction = jest.fn();
    // Limpiamos el historial de llamadas del mock de jwt.verify
    mockJwt.verify.mockClear();
  });

  // --- Tests para authenticateToken ---
  describe('authenticateToken', () => {
    it('debería retornar 401 si no se provee un token', () => {
      mockRequest.headers = {};
      authenticateToken(mockRequest, mockResponse, nextFunction);
      expect(mockResponse.sendStatus).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debería retornar 403 si el token es inválido', () => {
      mockRequest.headers = { authorization: 'Bearer invalidtoken' };
      // Simulamos que jwt.verify encuentra un error
      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Token inválido'), null);
      });

      authenticateToken(mockRequest, mockResponse, nextFunction);
      expect(mockResponse.sendStatus).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debería llamar a next() con los datos del usuario si el token es válido', () => {
      const userPayload = { userId: 1, role: 'usuario' };
      mockRequest.headers = { authorization: 'Bearer validtoken' };
      // Simulamos que jwt.verify decodifica el usuario correctamente
      mockJwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, userPayload);
      });

      authenticateToken(mockRequest, mockResponse, nextFunction);

      expect(mockRequest.user).toEqual(userPayload);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.sendStatus).not.toHaveBeenCalled();
    });
  });

  // --- Tests para authorizeAdmin ---
  describe('authorizeAdmin', () => {
    it('debería retornar 403 si el rol del usuario no es "administrador"', () => {
      mockRequest.user = { role: 'usuario' };
      authorizeAdmin(mockRequest, mockResponse, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Acceso denegado. Se requiere rol de administrador.' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debería llamar a next() si el rol del usuario es "administrador"', () => {
      mockRequest.user = { role: 'administrador' };
      authorizeAdmin(mockRequest, mockResponse, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  // --- Tests para authorizeSupervisor ---
  describe('authorizeSupervisor', () => {
    it('debería retornar 403 si el rol del usuario no es "supervisor" ni "administrador"', () => {
      mockRequest.user = { role: 'usuario' };
      authorizeSupervisor(mockRequest, mockResponse, nextFunction);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Acceso denegado. Se requiere rol de Supervisor o Administrador.' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('debería llamar a next() si el rol del usuario es "supervisor"', () => {
      mockRequest.user = { role: 'supervisor' };
      authorizeSupervisor(mockRequest, mockResponse, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('debería llamar a next() si el rol del usuario es "administrador"', () => {
      mockRequest.user = { role: 'administrador' };
      authorizeSupervisor(mockRequest, mockResponse, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });
  });
});