# 🩸 AWS Cloud-Based Dynamic Blood Bank Management System

A cloud-based Blood Bank Management System built using AWS services to manage blood availability, donors, hospital blood requests, blood matching, authentication, notifications, and monitoring.

## 🌐 Live Demo

**CloudFront Website:**

https://duvt0or2vadyh.cloudfront.net/

> Note: The live application requires Cognito authentication.

---

## 📌 Project Overview

The AWS Cloud-Based Dynamic Blood Bank Management System is designed to provide a centralized platform for managing blood inventory, registered donors, and emergency blood requests.

The system uses AWS cloud services for:

- Blood inventory management
- Donor management
- Hospital blood requests
- Blood availability checking
- Donor-recipient matching
- User authentication
- Role-based access control
- Emergency notifications
- Application monitoring
- Cloud-based website deployment

---

## 🎯 Objectives

- Track blood availability in real time.
- Manage registered blood donors.
- Allow hospitals to create blood requests.
- Find suitable blood inventory and donors.
- Send alerts for high-priority blood requests.
- Provide secure authentication using Amazon Cognito.
- Implement role-based access control.
- Monitor the application using Amazon CloudWatch.
- Deploy the web application using Amazon S3 and Amazon CloudFront.

---

# 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │       Users          │
                    │ Donor / Hospital /   │
                    │       Admin          │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    CloudFront        │
                    │   Web Application    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      Cognito         │
                    │ Authentication +     │
                    │ Role-Based Access    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    API Gateway       │
                    │     HTTP API         │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
      │   Lambda    │  │   Lambda    │  │   Lambda    │
      │ Inventory   │  │   Donors    │  │   Requests  │
      └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
             │                 │                 │
             └─────────────────┼─────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │      DynamoDB        │
                    │ BloodInventory       │
                    │ Donors               │
                    │ BloodRequests        │
                    └──────────────────────┘

                               │
                               ▼
                    ┌──────────────────────┐
                    │        SNS           │
                    │ Emergency Alerts     │
                    └──────────────────────┘

                    ┌──────────────────────┐
                    │     CloudWatch       │
                    │ Logs / Metrics /     │
                    │ Alarms / Dashboard   │
                    └──────────────────────┘