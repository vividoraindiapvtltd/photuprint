import React from 'react'

function RegisterForm() {
    <div className="formBox register">
        <form action="">s
            <h1>Registeration</h1>
            <div className="inputBox">
                <input type="text" placeholder="Username" required />
                <i class='bx bxs-user'></i>
            </div>
            <div className="inputBox">
                <input type="email" placeholder="Email" required />
                <i class='bx bxs-locck-alt'></i>
            </div>
            <div className="inputBox">
                <input type="password" placeholder="Password" required />
                <i class='bx bxs-locck-alt'></i>
            </div>
            <div className="inputBox">
                <input type="text" placeholder="Mobile" required />
                <i class='bx bxs-locck-alt'></i>
            </div>
            <button type="submit" className="btn">Login</button>
            <p>or login with social platforms</p>
            <div className="socialIcons">
                <a href="#"><i className="bx bxl-google"></i></a>
                <a href="#"><i className="bx bxl-facebooks"></i></a>
            </div>
        </form>
    </div>
}

export default RegisterForm;