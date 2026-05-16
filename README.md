# TIMZO

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/EJS-A9A9A9?style=for-the-badge&logo=ejs&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-0052FF?style=for-the-badge&logo=razorpay&logoColor=white)
![Nodemailer](https://img.shields.io/badge/Nodemailer-000000?style=for-the-badge&logo=nodemailer&logoColor=white)
![Multer](https://img.shields.io/badge/Multer-FF6600?style=for-the-badge&logo=multer&logoColor=white)
![Passport.js](https://img.shields.io/badge/Passport.js-3448C5?style=for-the-badge&logo=passport&logoColor=white)
![Nodemon](https://img.shields.io/badge/Nodemon-76D04B?style=for-the-badge&logo=nodemon&logoColor=white)

## Overview

TIMZO is a robust, full-stack web application built with Node.js, Express.js, and MongoDB, utilizing EJS for server-side templating. It features comprehensive user authentication, including local strategies and Google OAuth integration. The application supports secure file uploads and management through Cloudinary, facilitates online payments via Razorpay, and incorporates email notification capabilities using Nodemailer. Furthermore, TIMZO provides advanced functionalities for dynamic report generation in both PDF and Excel formats, alongside image processing capabilities with Sharp. Designed for scalability and maintainability, it adheres to a modular architecture.

## System Architecture

The TIMZO application follows a Model-View-Controller (MVC) architectural pattern, structured to ensure clear separation of concerns and maintainability:

*   **`app.js`**: The primary entry point of the application. It initializes the Express.js server, configures global middleware, establishes database connections, and registers all defined routes.
*   **`Config/`**: Contains configuration files for various services and settings, such as database connection parameters, API keys for third-party services (Cloudinary, Razorpay, Google OAuth), and environment variable management.
*   **`Controller/`**: Houses the business logic for handling incoming requests. Each controller function processes user input, interacts with models to perform data operations, and prepares data for rendering by the views.
*   **`Helpers/`**: A collection of utility functions and reusable code snippets that support various parts of the application, promoting code reusability and reducing redundancy.
*   **`MiddleWares/`**: Contains custom Express middleware functions used for tasks such as authentication, authorization, session management, error handling, and request logging (e.g., `morgan`, `nocache`).
*   **`Model/`**: Defines the data schemas and interacts directly with the MongoDB database using Mongoose. Each file represents a specific data entity (e.g., User, Product, Order).
*   **`Public/`**: Stores static assets served directly to the client, including CSS stylesheets, JavaScript files, images, and other client-side resources.
*   **`Routes/`**: Defines the API endpoints and maps them to the corresponding controller functions. This directory organizes the application's URL structure.
*   **`Views/`**: Contains the EJS template files responsible for rendering the dynamic HTML content that is sent to the client's browser.

## Prerequisites

Before running the TIMZO application, ensure you have the following installed:

*   **Node.js**: Version 18.x or higher (includes npm).
*   **MongoDB**: A running instance of MongoDB (local or cloud-hosted).
*   **Environment Variables**: A `.env` file in the root directory containing necessary API keys and configuration settings (e.g., `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `RAZORPAY_KEY_ID`, `GOOGLE_CLIENT_ID`, `NODEMAILER_USER`, etc.).

## Installation

To set up the project locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/ismailkt313/TIMZO.git
    cd TIMZO
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Create a `.env` file**:
    Create a file named `.env` in the root directory and populate it with your environment-specific variables. An example structure might look like this:
    ```
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/timzo_db
    SESSION_SECRET=your_session_secret_key
    CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
    CLOUDINARY_API_KEY=your_cloudinary_api_key
    CLOUDINARY_API_SECRET=your_cloudinary_api_secret
    RAZORPAY_KEY_ID=your_razorpay_key_id
    RAZORPAY_KEY_SECRET=your_razorpay_key_secret
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
    NODEMAILER_USER=your_email@example.com
    NODEMAILER_PASS=your_email_password
    ```

## Usage

To start the TIMZO application:

1.  **Ensure MongoDB is running.**
2.  **Run the application**:
    ```bash
    npm start
    ```
    The application will typically start on `http://localhost:3000` (or the port specified in your `.env` file).

<br/><br/>_Generated by [Auto-README](https://auto-readme-livid.vercel.app/)_
