import React from 'react'

function ToggleMessage() {
    <>
        <div className="toggleBox">
            <div className="togglePanel toggleLeft">
                <h1>Hello, Welcome</h1>
                <p>Don't have an account?</p>
                <button className="btn registerBtn">Register</button>
            </div>
        </div>
        <div className="toggleBox">
            <div className="togglePanel toggleLeft">
                <h1>Welcome Back!</h1>
                <p>Already have an account?</p>
                <button className="btn loginBtn">Login</button>
            </div>
        </div>
    </>
}

export default ToggleMessage;