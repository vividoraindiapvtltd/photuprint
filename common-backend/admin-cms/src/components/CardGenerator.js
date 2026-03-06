import React from 'react';
import { Link } from 'react-router-dom';

const CardGenerator = () => {
    return (
        <div className="whiteCardWrapper">
            <h3>📦 Product Management</h3>
            <p>Manage your products, categories, and inventory</p>
            <Link to="/products" className="linkStyle">
                Manage Products
            </Link>
        </div>
    )
}

export default CardGenerator;