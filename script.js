const API_URL = "https://34dz94rewh.execute-api.ap-south-1.amazonaws.com";

const COGNITO_DOMAIN =
    "https://ap-south-1hovmnzl9u.auth.ap-south-1.amazoncognito.com";

const CLIENT_ID = "575ghd4277hcst42q4i2opcod6";

const REDIRECT_URI = "https://duvt0or2vadyh.cloudfront.net/"


// ===============================
// LOGIN WITH COGNITO + PKCE
// ===============================

function generateRandomString(length = 64) {

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    let result = "";

    const randomValues =
        new Uint8Array(length);

    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {

        result +=
            characters[randomValues[i] % characters.length];
    }

    return result;
}


async function sha256(plain) {

    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(plain);

    return await crypto.subtle.digest(
        "SHA-256",
        data
    );
}


function base64UrlEncode(arrayBuffer) {

    const bytes =
        new Uint8Array(arrayBuffer);

    let binary = "";

    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}


async function createCodeChallenge(verifier) {

    const hashed =
        await sha256(verifier);

    return base64UrlEncode(hashed);
}


async function login() {

    // Remove old tokens
    localStorage.removeItem("access_token");
    localStorage.removeItem("id_token");
    localStorage.removeItem("refresh_token");

    // Clear old OAuth data
    sessionStorage.removeItem("pkce_code_verifier");

    // Generate PKCE verifier
    const codeVerifier =
        generateRandomString(64);

    // Generate PKCE challenge
    const codeChallenge =
        await createCodeChallenge(codeVerifier);

    // Store verifier temporarily
    sessionStorage.setItem(
        "pkce_code_verifier",
        codeVerifier
    );

    const loginUrl =
        COGNITO_DOMAIN +
        "/oauth2/authorize" +
        "?client_id=" +
        encodeURIComponent(CLIENT_ID) +
        "&response_type=code" +
        "&scope=" +
        encodeURIComponent("openid email") +
        "&code_challenge=" +
        encodeURIComponent(codeChallenge) +
        "&code_challenge_method=S256" +
        "&prompt=login" +
        "&redirect_uri=" +
        encodeURIComponent(REDIRECT_URI);

    console.log(
        "Cognito login URL:",
        loginUrl
    );

    window.location.href =
        loginUrl;
}


// ===============================
// GET AUTHORIZATION CODE
// ===============================

let authorizationCodeProcessed = false;


async function getAuthorizationCode() {

    // Prevent the same authorization code
    // from being exchanged more than once.
    if (authorizationCodeProcessed) {
        return null;
    }

    const params =
        new URLSearchParams(
            window.location.search
        );

    const code =
        params.get("code");

    if (!code) {
        return null;
    }

    authorizationCodeProcessed = true;

    // Get the PKCE verifier
    const codeVerifier =
        sessionStorage.getItem(
            "pkce_code_verifier"
        );

    if (!codeVerifier) {

        console.error(
            "PKCE code verifier not found."
        );

        const output =
            document.getElementById("output");

        if (output) {
            output.textContent =
                "Login error: PKCE session expired. Please login again.";
        }

        return null;
    }

    try {

        const response =
            await fetch(
                COGNITO_DOMAIN +
                "/oauth2/token",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        "grant_type=authorization_code" +
                        "&client_id=" +
                        encodeURIComponent(CLIENT_ID) +
                        "&code=" +
                        encodeURIComponent(code) +
                        "&redirect_uri=" +
                        encodeURIComponent(REDIRECT_URI) +
                        "&code_verifier=" +
                        encodeURIComponent(codeVerifier)
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                "Token error:",
                data
            );

            const output =
                document.getElementById("output");

            if (output) {

                output.textContent =
                    "Login token error: " +
                    JSON.stringify(
                        data,
                        null,
                        2
                    );
            }

            return null;
        }

        // Save tokens
        localStorage.setItem(
            "access_token",
            data.access_token
        );

        localStorage.setItem(
            "id_token",
            data.id_token
        );

        if (data.refresh_token) {

            localStorage.setItem(
                "refresh_token",
                data.refresh_token
            );
        }

        // Remove PKCE verifier after successful exchange
        sessionStorage.removeItem(
            "pkce_code_verifier"
        );

        // Remove ?code=... from browser URL
        window.history.replaceState(
            {},
            document.title,
            REDIRECT_URI
        );

        return data.access_token;

    } catch (error) {

        console.error(
            "Token exchange error:",
            error
        );

        const output =
            document.getElementById("output");

        if (output) {

            output.textContent =
                "Token exchange error: " +
                error.message;
        }

        return null;
    }
}

// ===============================
// GET TOKEN
// ===============================
async function getToken() {

    const token =
        localStorage.getItem("access_token");

    if (token) {
        return token;
    }

    return await getAuthorizationCode();
}


// ===============================
// GET BLOOD INVENTORY
// ===============================
async function getBlood() {

    const output =
        document.getElementById("output");

    output.innerHTML =
        "Loading blood availability...";

    try {

        const token = await getToken();

        if (!token) {

            output.textContent =
                "Please login first.";

            return;
        }

        const response = await fetch(
            `${API_URL}/blood`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            output.textContent =
                JSON.stringify(data, null, 2);

            return;
        }

        if (!data || data.length === 0) {

            output.innerHTML =
                "<p>No blood inventory available.</p>";

            return;
        }

        let table = `
            <div class="result-container">

                <h3>🩸 Blood Availability</h3>

                <table class="data-table">

                    <thead>
                        <tr>
                            <th>Blood Group</th>
                            <th>Quantity</th>
                            <th>City</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
        `;

        data.forEach(item => {

            table += `
                <tr>

                    <td>
                        <strong>
                            ${item.bloodGroup || "-"}
                        </strong>
                    </td>

                    <td>
                        ${item.quantity || 0} Units
                    </td>

                    <td>
                        ${item.city || "-"}
                    </td>

                    <td>
                        <span class="status">
                            ${item.status || "Available"}
                        </span>
                    </td>

                </tr>
            `;

        });

        table += `
                    </tbody>

                </table>

            </div>
        `;

        output.innerHTML = table;

    } catch (error) {

        output.textContent =
            "Error: " + error.message;
    }
}


// ===============================
// GET DONORS
// ===============================
async function getDonors() {

    const output =
        document.getElementById("output");

    output.innerHTML =
        "Loading donors...";

    try {

        const token = await getToken();

        if (!token) {

            output.textContent =
                "Please login first.";

            return;
        }

        const response = await fetch(
            `${API_URL}/donors`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            output.textContent =
                JSON.stringify(data, null, 2);

            return;
        }

        if (!data || data.length === 0) {

            output.innerHTML =
                "<p>No donors registered.</p>";

            return;
        }

        let table = `
            <div class="result-container">

                <h3>👤 Registered Blood Donors</h3>

                <table class="data-table">

                    <thead>
                        <tr>
                            <th>Donor ID</th>
                            <th>Name</th>
                            <th>Blood Group</th>
                            <th>City</th>
                            <th>Phone</th>
                            <th>Availability</th>
                        </tr>
                    </thead>

                    <tbody>
        `;

        data.forEach(donor => {

            const availability =
                donor.available === true
                    ? "Available"
                    : "Not Available";

            table += `
                <tr>

                    <td>
                        <strong>
                            ${donor.donorId || "-"}
                        </strong>
                    </td>

                    <td>
                        ${donor.name || "-"}
                    </td>

                    <td>
                        <strong>
                            ${donor.bloodGroup || "-"}
                        </strong>
                    </td>

                    <td>
                        ${donor.city || "-"}
                    </td>

                    <td>
                        ${donor.phone || "-"}
                    </td>

                    <td>
                        <span class="status">
                            ${availability}
                        </span>
                    </td>

                </tr>
            `;

        });

        table += `
                    </tbody>

                </table>

            </div>
        `;

        output.innerHTML = table;

    } catch (error) {

        output.textContent =
            "Error: " + error.message;
    }
}


// ===============================
// GET BLOOD REQUESTS
// ===============================
async function getRequests() {

    const output =
        document.getElementById("output");

    output.innerHTML =
        "Loading blood requests...";

    try {

        const token = await getToken();

        if (!token) {

            output.textContent =
                "Please login first.";

            return;
        }

        const response = await fetch(
            `${API_URL}/requests`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            output.textContent =
                JSON.stringify(data, null, 2);

            return;
        }

        if (!data || data.length === 0) {

            output.innerHTML =
                "<p>No blood requests available.</p>";

            return;
        }

        let table = `
            <div class="result-container">

                <h3>🏥 Blood Requests</h3>

                <table class="data-table">

                    <thead>
                        <tr>
                            <th>Request ID</th>
                            <th>Hospital</th>
                            <th>Blood Group</th>
                            <th>Units</th>
                            <th>City</th>
                            <th>Urgency</th>
                            <th>Status</th>
                        </tr>
                    </thead>

                    <tbody>
        `;

        data.forEach(request => {

            table += `
                <tr>

                    <td>
                        <strong>
                            ${request.requestId || "-"}
                        </strong>
                    </td>

                    <td>
                        ${request.hospitalName || "-"}
                    </td>

                    <td>
                        <strong>
                            ${request.bloodGroup || "-"}
                        </strong>
                    </td>

                    <td>
                        ${request.unitsRequired || 0}
                    </td>

                    <td>
                        ${request.city || "-"}
                    </td>

                    <td>
                        <span class="status">
                            ${request.urgency || "-"}
                        </span>
                    </td>

                    <td>
                        ${request.status || "Pending"}
                    </td>

                </tr>
            `;

        });

        table += `
                    </tbody>

                </table>

            </div>
        `;

        output.innerHTML = table;

    } catch (error) {

        output.textContent =
            "Error: " + error.message;
    }
}


// ===============================
// CREATE BLOOD REQUEST
// ===============================

document.getElementById("requestForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const output =
            document.getElementById("output");

        output.innerHTML =
            "Creating blood request...";

        try {

            const token = await getToken();

            if (!token) {

                output.textContent =
                    "Please login first.";

                return;
            }

            const requestData = {

                requestId:
                    document.getElementById("requestId").value.trim(),

                hospitalName:
                    document.getElementById("hospitalName").value.trim(),

                bloodGroup:
                    document.getElementById("bloodGroup").value,

                unitsRequired:
                    Number(
                        document.getElementById("unitsRequired").value
                    ),

                city:
                    document.getElementById("city").value.trim(),

                urgency:
                    document.getElementById("urgency").value
            };

            const response = await fetch(
                `${API_URL}/request`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization":
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify(requestData)
                }
            );

            const data =
                await response.json();

            if (!response.ok) {

                output.textContent =
                    JSON.stringify(data, null, 2);

                return;
            }


            // ===============================
            // SUCCESS MESSAGE
            // ===============================

            output.innerHTML = `

                <div class="success-message">

                    <div class="success-icon">
                        ✓
                    </div>

                    <h3>
                        Blood Request Created Successfully
                    </h3>

                    <p>
                        Your blood request has been successfully
                        submitted to the Blood Bank System.
                    </p>


                    <div class="request-success-details">


                        <div>

                            <span>
                                Request ID
                            </span>

                            <strong>
                                ${data.requestId || requestData.requestId}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Hospital
                            </span>

                            <strong>
                                ${requestData.hospitalName}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Blood Group
                            </span>

                            <strong>
                                ${requestData.bloodGroup}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Units Required
                            </span>

                            <strong>
                                ${requestData.unitsRequired}
                            </strong>

                        </div>


                        <div>

                            <span>
                                City
                            </span>

                            <strong>
                                ${requestData.city}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Urgency
                            </span>

                            <strong>
                                ${requestData.urgency}
                            </strong>

                        </div>

                    </div>


                    ${
                        requestData.urgency === "HIGH"
                        ? `
                            <div class="urgent-message">

                                🚨 HIGH PRIORITY REQUEST
                                <br>

                                Emergency notification has been sent.

                            </div>
                        `
                        : ""
                    }

                </div>

            `;


            // Clear the form
            document.getElementById("requestForm").reset();


        } catch (error) {

            output.textContent =
                "Error: " + error.message;
        }
    }
);


// ===============================
// FIND BLOOD MATCH
// ===============================

document.getElementById("matchForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const output =
            document.getElementById("output");

        output.innerHTML =
            "Finding blood match...";

        try {

            const token = await getToken();

            if (!token) {

                output.textContent =
                    "Please login first.";

                return;
            }

            const requestId =
                document
                    .getElementById("matchRequestId")
                    .value
                    .trim();

            const response = await fetch(
                `${API_URL}/match`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
                            requestId: requestId
                        })
                }
            );

            const data =
                await response.json();

            if (!response.ok) {

                output.textContent =
                    JSON.stringify(data, null, 2);

                return;
            }


            // ===============================
            // REQUEST INFORMATION
            // ===============================

            let result = `

                <div class="result-container">

                    <h3>
                        🔍 Blood Match Result
                    </h3>


                    <div class="match-summary">


                        <div class="summary-card">

                            <span>
                                Request ID
                            </span>

                            <strong>
                                ${data.requestId || "-"}
                            </strong>

                        </div>


                        <div class="summary-card">

                            <span>
                                Hospital
                            </span>

                            <strong>
                                ${data.hospitalName || "-"}
                            </strong>

                        </div>


                        <div class="summary-card">

                            <span>
                                Blood Group
                            </span>

                            <strong>
                                ${data.bloodGroup || "-"}
                            </strong>

                        </div>


                        <div class="summary-card">

                            <span>
                                Units Required
                            </span>

                            <strong>
                                ${data.unitsRequired || 0}
                            </strong>

                        </div>


                        <div class="summary-card">

                            <span>
                                City
                            </span>

                            <strong>
                                ${data.city || "-"}
                            </strong>

                        </div>


                        <div class="summary-card">

                            <span>
                                Urgency
                            </span>

                            <strong>
                                ${data.urgency || "-"}
                            </strong>

                        </div>

                    </div>


                    <!-- INVENTORY RESULT -->

                    <h4>
                        🩸 Blood Inventory Match
                    </h4>


                    <p class="availability-result">

                        Available Units:

                        <strong>
                            ${data.inventory?.availableUnits || 0}
                        </strong>

                    </p>


                    <p class="availability-result">

                        Availability:

                        <strong>
                            ${data.inventory?.availability || "UNKNOWN"}
                        </strong>

                    </p>

            `;


            // ===============================
            // MATCHING INVENTORY TABLE
            // ===============================

            const inventory =
                data.inventory?.matchingInventory || [];


            if (inventory.length > 0) {

                result += `

                    <table class="data-table">

                        <thead>

                            <tr>

                                <th>
                                    Blood Group
                                </th>

                                <th>
                                    Quantity
                                </th>

                                <th>
                                    City
                                </th>

                                <th>
                                    Status
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                `;


                inventory.forEach(item => {

                    result += `

                        <tr>

                            <td>
                                <strong>
                                    ${item.bloodGroup || "-"}
                                </strong>
                            </td>

                            <td>
                                ${item.quantity || 0} Units
                            </td>

                            <td>
                                ${item.city || "-"}
                            </td>

                            <td>
                                ${item.status || "-"}
                            </td>

                        </tr>

                    `;

                });


                result += `

                        </tbody>

                    </table>

                `;

            } else {

                result += `

                    <p>
                        No matching blood inventory found.
                    </p>

                `;

            }


            // ===============================
            // MATCHING DONORS
            // ===============================

            const donors =
                data.matchingDonors || [];


            result += `

                <h4>
                    👤 Matching Donors
                </h4>

            `;


            if (donors.length > 0) {

                result += `

                    <table class="data-table">

                        <thead>

                            <tr>

                                <th>
                                    Donor ID
                                </th>

                                <th>
                                    Name
                                </th>

                                <th>
                                    Blood Group
                                </th>

                                <th>
                                    City
                                </th>

                                <th>
                                    Phone
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                `;


                donors.forEach(donor => {

                    result += `

                        <tr>

                            <td>
                                <strong>
                                    ${donor.donorId || "-"}
                                </strong>
                            </td>

                            <td>
                                ${donor.name || "-"}
                            </td>

                            <td>
                                <strong>
                                    ${donor.bloodGroup || "-"}
                                </strong>
                            </td>

                            <td>
                                ${donor.city || "-"}
                            </td>

                            <td>
                                ${donor.phone || "-"}
                            </td>

                        </tr>

                    `;

                });


                result += `

                        </tbody>

                    </table>

                `;

            } else {

                result += `

                    <p>
                        No matching donors found.
                    </p>

                `;

            }


            result += `

                </div>

            `;


            output.innerHTML =
                result;


        } catch (error) {

            output.textContent =
                "Error: " + error.message;
        }

    }
);
// ===============================
// LOAD DASHBOARD STATISTICS
// ===============================

async function loadDashboardStats() {

    try {

        const token = await getToken();

        if (!token) {
            return;
        }


        // ===============================
        // BLOOD INVENTORY
        // ===============================

        const bloodResponse = await fetch(
            `${API_URL}/blood`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        const bloodData =
            await bloodResponse.json();


        if (bloodResponse.ok && Array.isArray(bloodData)) {

            let totalUnits = 0;

            bloodData.forEach(item => {

                totalUnits +=
                    Number(item.quantity || 0);

            });

            document.getElementById(
                "totalBloodUnits"
            ).textContent = totalUnits;

        }


        // ===============================
        // DONORS
        // ===============================

        const donorResponse = await fetch(
            `${API_URL}/donors`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        const donorData =
            await donorResponse.json();


        if (donorResponse.ok && Array.isArray(donorData)) {

            document.getElementById(
                "totalDonors"
            ).textContent = donorData.length;

        }


        // ===============================
        // REQUESTS
        // ===============================

        const requestResponse = await fetch(
            `${API_URL}/requests`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );

        const requestData =
            await requestResponse.json();


        if (requestResponse.ok && Array.isArray(requestData)) {

            document.getElementById(
                "totalRequests"
            ).textContent = requestData.length;


            // Count HIGH priority requests

            const highPriority =
                requestData.filter(
                    request =>
                        request.urgency === "HIGH"
                ).length;


            document.getElementById(
                "highPriorityRequests"
            ).textContent = highPriority;

        }

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

    }
}


// ===============================
// LOAD DASHBOARD AFTER PAGE LOAD
// ===============================

window.addEventListener(
    "load",
    loadDashboardStats
);
// ===============================
// GET LOGGED-IN USER ROLE
// ===============================

function getUserRole() {

    const idToken = localStorage.getItem("id_token");

    if (!idToken) {
        return null;
    }

    try {

        const payload = idToken.split(".")[1];

        const decoded = JSON.parse(
            atob(
                payload
                    .replace(/-/g, "+")
                    .replace(/_/g, "/")
            )
        );

        const groups = decoded["cognito:groups"] || [];

        // Admin has highest priority
        if (groups.includes("Admin")) {
            return "Admin";
        }

        if (groups.includes("Hospital")) {
            return "Hospital";
        }

        if (groups.includes("Donor")) {
            return "Donor";
        }

        return null;

    } catch (error) {

        console.error(
            "Unable to read user role:",
            error
        );

        return null;
    }
}


// ===============================
// SHOW LOGGED-IN USER ROLE
// ===============================

function displayUserRole() {

    const roleElement =
        document.getElementById("userRole");

    if (!roleElement) {
        return;
    }

    const role = getUserRole();

    if (!role) {

        roleElement.textContent =
            "Not logged in";

        return;
    }

    roleElement.textContent =
        "Logged in as: " + role;
}


// ===============================
// ROLE-BASED ACCESS
// ===============================

function applyRoleAccess() {

    const role = getUserRole();

    const donorsCard =
        document.getElementById("donorsCard");

    const requestsCard =
        document.getElementById("requestsCard");

    const createRequestSection =
        document.getElementById("createRequestSection");

    const matchSection =
        document.getElementById("matchSection");


    // ===============================
    // NOT LOGGED IN
    // ===============================

    if (!role) {

        if (donorsCard) {
            donorsCard.style.display = "none";
        }

        if (requestsCard) {
            requestsCard.style.display = "none";
        }

        if (createRequestSection) {
            createRequestSection.style.display = "none";
        }

        if (matchSection) {
            matchSection.style.display = "none";
        }

        return;
    }


    // ===============================
    // DONOR
    // ===============================

    if (role === "Donor") {

        // Donor cannot see donor management
        if (donorsCard) {
            donorsCard.style.display = "none";
        }

        // Donor cannot see hospital requests
        if (requestsCard) {
            requestsCard.style.display = "none";
        }

        // Donor cannot create blood requests
        if (createRequestSection) {
            createRequestSection.style.display = "none";
        }

        // Donor cannot perform matching
        if (matchSection) {
            matchSection.style.display = "none";
        }
    }


    // ===============================
    // HOSPITAL
    // ===============================

    else if (role === "Hospital") {

        // Hospital does not manage donors
        if (donorsCard) {
            donorsCard.style.display = "none";
        }

        // Hospital does not see all request management
        if (requestsCard) {
            requestsCard.style.display = "none";
        }

        // Hospital can create requests
        if (createRequestSection) {
            createRequestSection.style.display = "block";
        }

        // Hospital can find blood matches
        if (matchSection) {
            matchSection.style.display = "block";
        }
    }


    // ===============================
    // ADMIN
    // ===============================

    else if (role === "Admin") {

        // Admin can see donors
        if (donorsCard) {
            donorsCard.style.display = "block";
        }

        // Admin can see requests
        if (requestsCard) {
            requestsCard.style.display = "block";
        }

        // Admin can create requests
        if (createRequestSection) {
            createRequestSection.style.display = "block";
        }

        // Admin can find matches
        if (matchSection) {
            matchSection.style.display = "block";
        }
    }
}


// ===============================
// RUN ROLE SYSTEM AFTER PAGE LOAD
// ===============================

window.addEventListener("load", () => {

    displayUserRole();

    applyRoleAccess();

    updateAuthButtons();

});
// =====================================
// COGNITO LOGOUT
// =====================================

function logoutUser() {

    localStorage.removeItem(
        "access_token"
    );

    localStorage.removeItem(
        "id_token"
    );

    localStorage.removeItem(
        "refresh_token"
    );

    sessionStorage.clear();

    const logoutUrl =
        COGNITO_DOMAIN +
        "/logout" +
        "?client_id=" +
        encodeURIComponent(CLIENT_ID) +
        "&logout_uri=" +
        encodeURIComponent(REDIRECT_URI);

    console.log(
        "Cognito logout URL:",
        logoutUrl
    );

    window.location.href =
        logoutUrl;
}
// =====================================
// UPDATE LOGIN / LOGOUT BUTTONS
// =====================================

function updateAuthButtons() {

    const loginButton = document.getElementById("loginButton");
    const logoutButton = document.getElementById("logoutButton");

    const idToken = localStorage.getItem("id_token");

    if (idToken) {

        // User is logged in
        if (loginButton) {
            loginButton.style.display = "none";
        }

        if (logoutButton) {
            logoutButton.style.display = "inline-block";
        }

    } else {

        // User is logged out
        if (loginButton) {
            loginButton.style.display = "inline-block";
        }

        if (logoutButton) {
            logoutButton.style.display = "none";
        }
    }
}