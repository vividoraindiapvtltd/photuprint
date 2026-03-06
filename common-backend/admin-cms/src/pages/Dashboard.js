import React from 'react';
import { Outlet } from "react-router-dom";
import { useAuth } from '../context/AuthContext';
import LeftContainer from '../components/LeftContainer';
import RightContainer from '../components/RightContainer';
import dashboardLinks from '../data/dashboardLinks.json';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboardLayout">
      <LeftContainer data={dashboardLinks} />
      <RightContainer>
        <Outlet />
      </RightContainer>
    </div>
  );
}
