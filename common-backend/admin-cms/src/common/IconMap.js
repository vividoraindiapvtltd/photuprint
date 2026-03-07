// src/components/IconMap.js
import React from "react";
import { MdLogout } from "react-icons/md";
import { FcGoogle } from "react-icons/fc";
import { MdAddAPhoto } from "react-icons/md";
import { MdAccessTime } from "react-icons/md";
import { MdAccountBalanceWallet } from "react-icons/md";
import { MdAccountCircle } from "react-icons/md";
import { MdAccountBox } from "react-icons/md";
import { MdAdd } from "react-icons/md";
import { MdAddCard } from "react-icons/md";
import { MdClose } from "react-icons/md";
import { MdDensitySmall } from "react-icons/md";
import { MdDelete } from "react-icons/md";
import { MdDiscount } from "react-icons/md";
import { MdDone } from "react-icons/md";
import { MdDownload } from "react-icons/md";
import { MdDownloadDone } from "react-icons/md";
import { MdExpandLess } from "react-icons/md";
import { MdExpandMore } from "react-icons/md";
import { MdFileUpload } from "react-icons/md";
import { MdInfoOutline } from "react-icons/md";
import { MdPerson } from "react-icons/md";
import { MdShoppingCart } from "react-icons/md";
import { MdLocalShipping } from "react-icons/md";
import { MdReceipt } from "react-icons/md";
import { MdBusiness } from "react-icons/md";
import { MdLanguage } from "react-icons/md";
import { MdSwapHoriz } from "react-icons/md";
import { MdImage } from "react-icons/md";
import { MdCalculate } from "react-icons/md";
import { MdExtension } from "react-icons/md";
import { MdStraighten } from "react-icons/md";
import { MdPrint } from "react-icons/md";
import { MdFormatQuote } from "react-icons/md";
import { MdTransform } from "react-icons/md";
import { MdDashboard } from "react-icons/md";
import { MdViewModule } from "react-icons/md";
import { MdHome } from "react-icons/md";
import { MdPeople } from "react-icons/md";
import { MdContacts } from "react-icons/md";
import { MdSecurity } from "react-icons/md";
import { MdAdminPanelSettings } from "react-icons/md";
import { MdVerticalAlignBottom } from "react-icons/md";
import { MdPalette } from "react-icons/md";
import { MdViewCarousel } from "react-icons/md";

const iconMap = {
    FcGoogle,
    MdLogout,
    MdAddAPhoto,
    MdAccessTime,
    MdAccountBalanceWallet,
    MdAccountCircle,
    MdAccountBox,
    MdAdd,
    MdAddCard,
    MdClose,
    MdDensitySmall,
    MdDelete,
    MdDiscount,
    MdDone,
    MdDownload,
    MdDownloadDone,
    MdExpandLess,
    MdExpandMore,
    MdFileUpload,
    MdInfoOutline,
    MdPerson,
    MdShoppingCart,
    MdLocalShipping,
    MdReceipt,
    MdBusiness,
    MdLanguage,
    MdSwapHoriz,
    MdImage,
    MdCalculate,
    MdExtension,
    MdStraighten,
    MdPrint,
    MdFormatQuote,
    MdTransform,
    MdDashboard,
    MdViewModule,
    MdHome,
    MdPeople,
    MdContacts,
    MdSecurity,
    MdAdminPanelSettings,
    MdVerticalAlignBottom,
    MdPalette,
    MdViewCarousel
  };
  
  export default function IconMap({ name, size = 30 }) {
    const Icon = iconMap[name]; // pick component
    return Icon ? <Icon size={size} /> : null; // render dynamically
  }
  
  
