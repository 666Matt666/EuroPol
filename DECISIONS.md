# Registro de Decisiones de Arquitectura (ADR)

Este documento registra las decisiones de arquitectura importantes tomadas durante el desarrollo del proyecto EuroPol.

---

## ADR-001: Elección de la Pila Tecnológica Principal

*   **Fecha:** 2024-09-28
*   **Estado:** Aceptado

### Contexto
Se necesita una pila tecnológica moderna, robusta y con buen soporte de la comunidad para construir una aplicación web Full-Stack. La aplicación debe tener una clara separación entre la lógica del cliente (frontend) y la del servidor (backend).

### Decisión
Se ha decidido utilizar el siguiente stack:
*   **Frontend:** Vue.js (Vue 3) con Vue Router.
*   **Backend:** Node.js con el framework Express.js.
*   **Base de Datos:** PostgreSQL.

### Consecuencias
*   **Positivas:**
    *   Fuerte separación de responsabilidades, lo que facilita el desarrollo y mantenimiento.
    *   Vue.js es conocido por su curva de aprendizaje amigable y su rendimiento.
    *   Node.js/Express es un ecosistema maduro y muy popular para la creación de APIs.
    *   PostgreSQL es una base de datos relacional potente, de código abierto y muy fiable.
*   **Negativas:**
    *   Requiere gestionar dos bases de código separadas (frontend y backend).

---

## ADR-002: Implementación de Auditoría Desacoplada con Kafka

*   **Fecha:** 2024-09-28
*   **Estado:** Aceptado

### Contexto
Es necesario registrar eventos críticos del sistema (creación, modificación, eliminación de datos) para fines de auditoría y trazabilidad. Este proceso de registro no debe afectar el rendimiento ni el tiempo de respuesta de las peticiones principales de la API.

### Decisión
Se implementará un sistema de auditoría asíncrono utilizando Apache Kafka como broker de mensajes.
1.  El **Backend (API)** actuará como **Productor**. Al realizar una acción crítica, enviará un mensaje a un topic de Kafka (`audit-logs`) y continuará su ejecución normal.
2.  Un **servicio independiente (Consumidor)** se suscribirá a dicho topic, procesará los mensajes y los guardará de forma persistente en una tabla `audit_logs` en la base de datos PostgreSQL.

### Consecuencias
*   **Positivas:**
    *   **Desacoplamiento:** El registro de auditoría no está atado a la lógica de negocio principal.
    *   **Rendimiento:** Las respuestas de la API son rápidas, ya que no esperan a que el log se escriba en la base de datos.
    *   **Resiliencia:** Si el servicio consumidor se cae, los mensajes de auditoría permanecen en Kafka y pueden ser procesados más tarde, sin pérdida de datos.
*   **Negativas:**
    *   **Complejidad Operacional:** Introduce más partes móviles en la arquitectura (Zookeeper, Kafka, el proceso consumidor) que deben ser gestionadas y monitorizadas.