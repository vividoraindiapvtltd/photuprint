import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import { Outlet } from "react-router-dom";

const RightContainer = () => {
  return (
    <div className="flexOne spaceBetween rightContainer">
      <div className="flex-shrink-0">
        <Header />
      </div>
      <div className="flexOne overflow-y-auto paddingAll30">
        <Outlet />
      </div>
      <div className="flex-shrink-0">
        <Footer />
      </div>
    </div>
  );
};
export default RightContainer;