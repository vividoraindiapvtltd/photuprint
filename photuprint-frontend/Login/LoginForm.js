import react from 'react';

function LoginForm ()  {
    return(
        <div className="formBox login">
            <form action="">
                <h1>Login</h1>
                <div className="inputBox">
                    <input type="text" placeholder="Username" required />
                    <i class='bx bxs-user'></i>
                </div>
                <div className="inputBox">
                    <input type="password" placeholder="Password" required />
                    <i class='bx bxs-locck-alt'></i>
                </div>
                <div className="forgotLink">
                    <a href="">Forgot password?</a>
                </div>
                <button type="submit" className="btn">Login</button>
                <p>or login with social platforms</p>
                <div className="socialIcons">
                    <a href="#"><i className="bx bxl-google"></i></a>
                    <a href="#"><i className="bx bxl-facebooks"></i></a>
                </div>
            </form>
        </div>
    )
}

export default LoginForm;