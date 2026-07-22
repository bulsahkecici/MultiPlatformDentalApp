export const environment = {
    production: true,
    // Production'da Angular, REST API ve Socket.IO ile aynı origin'den
    // servis edilir (Caddy/nginx /api ve /socket.io yollarını backend'e iletir).
    apiUrl: '',
    socketUrl: ''
};
