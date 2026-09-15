import React from 'react';
import {Navigate} from 'react-router-dom';
import useOwnerAccess from './useOwnerAccess';
export default function OwnerOnly({children}){const {loading,isOwner}=useOwnerAccess();if(loading)return <p className="site-content-placeholder" role="status">Checking account…</p>;return isOwner?children:<Navigate to="/" replace/>;}
