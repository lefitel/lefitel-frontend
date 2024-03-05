import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Grid,
  Tab,
  Tabs,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import CustomTabComponent from "../../../components/CustomTabComponent";
import {
  ArrowBackIos,
} from "@mui/icons-material";

import EditUserDialog from "../../../components/dialogs/edits/EditUserDialog";
import SeguridadDetalleDataSec from "./detalle/SeguridadDetalleDataSec";
import SeguridadDetalleBitacraSec from "./detalle/SeguridadDetalleBitacraSec";
import { UsuarioInterface } from "../../../interfaces/interfaces";
import { searchUsuario } from "../../../api/Usuario.api";
import { SesionContext } from "../../../context/SesionProvider";

interface SeguridadDetalleSecProps {
  userId: number;
  setUserId: React.Dispatch<React.SetStateAction<number | null>>;
}


const SeguridadDetalleSec: React.FC<SeguridadDetalleSecProps> = ({ userId, setUserId }) => {
  //const [open, setOpen] = useState(false);
  //const [list, setList] = useState<BitacoraInterface[]>();

  const [data, setData] = useState<UsuarioInterface>();
  const { sesion } = useContext(SesionContext);
  const [value, setValue] = useState(0);

  useEffect(() => {
    recibirDatos()
  }, [])


  const recibirDatos = async () => {
    setData(await searchUsuario(userId, sesion.token))
    //setList(await getBitacora(userId, sesion.token))
  }



  const handleChange = (_event: React.SyntheticEvent<Element, Event>, newValue: number) => {
    setValue(newValue);
  };

  function a11yProps(index: number) {
    return {
      id: `simple-tab-${index}`,
      "aria-controls": `simple-tabpanel-${index}`,
    };
  }

  return (
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        minHeight: { xs: "calc(100vh - 64px)", md: "" },
        alignItems: "stretch",
        margin: 0,
      }}
    >
      <Grid
        item
        sx={{
          maxHeight: { xs: "auto", md: "100%" },
        }}
        display={"flex"}
        flexDirection={"column"}
        xs={12}
        md={12}
      >
        <Card
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
          variant="outlined"
        >
          <CardContent
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <Box sx={{ width: "100%" }}>
              <Box color="text.secondary">
                <Grid
                  display={"flex"}
                  alignItems={"center"}
                  justifyContent={"space-between"}
                >
                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      startIcon={<ArrowBackIos />}
                      onClick={() => {
                        setUserId(null);
                      }}
                    ></Button>
                    {data ? <EditUserDialog user={data} functionApp={recibirDatos} /> : null}



                  </ButtonGroup>
                </Grid>
                <Tabs
                  value={value}
                  onChange={handleChange}
                  aria-label="basic tabs example"
                  scrollButtons
                  variant="scrollable"
                >
                  <Tab
                    sx={{ textTransform: "unset" }}
                    label="Detalle"
                    {...a11yProps(0)}
                  />
                  <Tab
                    sx={{ textTransform: "unset" }}
                    label="Bitacora"
                    {...a11yProps(1)}
                  />
                </Tabs>
              </Box>
              <CustomTabComponent value={value} index={0}>
                {data ? <SeguridadDetalleDataSec data={data} />
                  : <></>}
              </CustomTabComponent>
              <CustomTabComponent value={value} index={1}>
                <SeguridadDetalleBitacraSec userId={userId} />
              </CustomTabComponent>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
export default SeguridadDetalleSec;
