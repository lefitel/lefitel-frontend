import { styled, useTheme, Theme, CSSObject } from '@mui/material/styles';
import Box from "@mui/material/Box";
import MuiDrawer from "@mui/material/Drawer";
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from "@mui/material/Toolbar";
import List from "@mui/material/List";
import CssBaseline from "@mui/material/CssBaseline";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import {
  AdminPanelSettings,
  BarChart,
  Settings,
  ExitToAppRounded,
  Dashboard,
  WifiTetheringError,
  CellTower,
  CellWifiTwoTone,
} from "@mui/icons-material";
import ParametrosPage from "../pages/menu/ParametrosPage";
import { useContext, useEffect, useState } from "react";
import PostePage from "../pages/menu/PostePage";
import ReportePage from "../pages/menu/ReportePage";
import AjustePage from "../pages/menu/AjustePage";
import SeguridadPage from "../pages/menu/SeguridadPage";
import { SesionContext } from "../context/SesionProvider";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
} from "@mui/material";
import InicioPage from "../pages/menu/InicioPage";
import EventoPage from '../pages/menu/EventoPage';
import { usuarioExample } from '../data/example';


interface MenuInterface {
  text: string;
  icon: JSX.Element;
  route: JSX.Element;
}

const MenuListUser1: MenuInterface[] = [
  {
    text: "Inicio",
    icon: <Dashboard />,
    route: <InicioPage />,
  },
  {
    text: "Postes",
    icon: <CellTower />,
    route: <PostePage />,
  },
  {
    text: "Eventos",
    icon: <CellWifiTwoTone />,
    route: <EventoPage />,
  },
  {
    text: "Parametros",
    icon: <WifiTetheringError />,
    route: <ParametrosPage />,
  },
  {
    text: "Reportes",
    icon: <BarChart />,
    route: <ReportePage />,
  },
  {
    text: "Seguridad",
    icon: <AdminPanelSettings />,
    route: <SeguridadPage />,
  },
  {
    text: "Ajustes",
    icon: <Settings />,
    route: <AjustePage />,
  }
];


const MenuListUser2 = [
  {
    text: "Inicio",
    icon: <Dashboard />,
    route: <InicioPage />,
  },
  {
    text: "Postes",
    icon: <CellTower />,
    route: <PostePage />,
  },
  {
    text: "Eventos",
    icon: <CellWifiTwoTone />,
    route: <EventoPage />,
  },
  {
    text: "Reportes",
    icon: <BarChart />,
    route: <ReportePage />,
  },
  {
    text: "Ajustes",
    icon: <Settings />,
    route: <AjustePage />,
  }
];

const MenuListUser3 = [
  {
    text: "Inicio",
    icon: <Dashboard />,
    route: <InicioPage />,
  },
  {
    text: "Reportes",
    icon: <BarChart />,
    route: <ReportePage />,
  },
  {
    text: "Ajustes",
    icon: <Settings />,
    route: <AjustePage />,
  }
];


const drawerWidth = 240;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});
const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));
const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

const DrawerComponent = () => {
  const { setSesion, sesion } = useContext(SesionContext);

  const theme = useTheme();
  const [openMenu, setOpenMenu] = useState(false);
  const [page, setPage] = useState(MenuListUser3[0]);
  const [openDialog, setOpenDialog] = useState(false);
  const [menuList, setMenuList] = useState<MenuInterface[]>(MenuListUser3);

  useEffect(() => {
    if (sesion.usuario.id_rol === 1) setMenuList(MenuListUser1)
    if (sesion.usuario.id_rol === 2) setMenuList(MenuListUser2)

    if (sesion.usuario.id_rol === 3) setMenuList(MenuListUser3)
    console.log(sesion)
  }, [])


  const handleClickOpen = () => {
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
  };
  const handleDrawerOpen = () => {
    setOpenMenu(true);
  };

  const handleDrawerClose = () => {
    setOpenMenu(false);
  };
  const cerrarSesion = () => {
    window.localStorage.removeItem("token");
    setSesion({ token: "", usuario: usuarioExample });
  };

  return (
    <Box className="box-main" sx={{ display: "flex", minHeight: "100vh" }}>
      <CssBaseline />
      <AppBar variant="outlined" elevation={0} position="fixed" open={openMenu}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{
              marginRight: 5,
              ...(openMenu && { display: "none" }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {page.text}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />

          <IconButton
            title={"Cerrar Sesión"}
            onClick={handleClickOpen}
            color="inherit"
          >
            {" "}
            <ExitToAppRounded />{" "}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer variant="permanent" open={openMenu}>
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            {theme.direction === "rtl" ? (
              <ChevronRightIcon />
            ) : (
              <ChevronLeftIcon />
            )}
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          {menuList.map((item) => {




            return <ListItem key={item.text} disablePadding sx={{ display: "block" }}>
              <ListItemButton
                sx={{
                  minHeight: 48,
                  justifyContent: openMenu ? "initial" : "center",
                  px: 2.5,
                }}
                onClick={() => setPage(item)}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: openMenu ? 3 : "auto",
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{ opacity: openMenu ? 1 : 0 }}
                />
              </ListItemButton>
            </ListItem>
          })}
        </List>
        <Divider />
      </Drawer>
      <Grid container sx={{ flexGrow: 1, p: 0, m: 0 }}>
        <DrawerHeader />
        {page.route}
      </Grid>
      <Dialog
        open={openDialog}
        keepMounted
        onClose={handleClose}
        aria-describedby="alert-dialog-slide-description"
      >
        <DialogTitle>
          {"Estás seguro de que quieres cerrar sesión?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description">
            Al cerrar sesión se borraran tus credenciales y la próxima vez
            tentrás que volver a introducirlas
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>No</Button>
          <Button variant="contained" onClick={cerrarSesion}>
            Si
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DrawerComponent;







