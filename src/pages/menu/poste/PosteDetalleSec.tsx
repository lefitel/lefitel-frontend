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
import { useEffect, useState } from "react";
import CustomTabComponent from "../../../components/CustomTabComponent";
import {
  ArrowBackIos,
  QuestionMark,
} from "@mui/icons-material";

import AddEventoDialog from "../../../components/dialogs/add/AddEventoDialog";
import EditPosteDialog from "../../../components/dialogs/edits/EditPosteDialog";
import PosteDetalleEventoSec from "./detalle/PosteDetalleEventoSec";
import PosteDetalleDataSec from "./detalle/PosteDetalleDataSec";
import SimpleDialogComponent from "../../../components/SimpleDialogComp";
import InfoPosteDetalleDialog from "../../../components/dialogs/InfoPosteDetalleDialog";
import { AdssInterface, AdssPosteInterface, EventoInterface, PosteInterface } from "../../../interfaces/interfaces";
import { searchPoste } from "../../../api/Poste.api";
import { getAdss } from "../../../api/Adss.api";
import { getAdssPoste } from "../../../api/AdssPoste.api";

interface PosteDetalleSecProps {
  posteId: number;
  setPosteId: React.Dispatch<React.SetStateAction<number | null>>;
}
const PosteDetalleSec: React.FC<PosteDetalleSecProps> = ({ posteId, setPosteId }) => {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<EventoInterface[]>();
  const [listAdssPoste, setListAdssPoste] = useState<AdssPosteInterface[]>();

  const [data, setData] = useState<PosteInterface>();

  useEffect(() => {
    recibirDatos()
  }, [open])


  const recibirDatos = async () => {
    setData(await searchPoste(posteId))
    setListAdssPoste(await getAdssPoste(posteId))
    //setList(await getEve(posteId))
  }
  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  function a11yProps(index) {
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
                  <ButtonGroup
                    size="small"
                    variant="outlined"
                    aria-label="outlined primary button group"
                  >
                    <Button
                      startIcon={<ArrowBackIos />}
                      onClick={() => {
                        setPosteId(null);
                      }}
                    ></Button>
                    {data ? <EditPosteDialog functionApp={recibirDatos} poste={data} /> : null}
                    {data ? <AddEventoDialog functionApp={recibirDatos} poste={data} /> : null}


                    <SimpleDialogComponent
                      label=""
                      title="Como funciona esta pantalla?"
                      icon={<QuestionMark />}
                      content={<InfoPosteDetalleDialog />}
                    />
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
                    label="Historial de Eventos"
                    {...a11yProps(1)}
                  />
                </Tabs>
              </Box>
              <CustomTabComponent value={value} index={0}>
                {data ? <PosteDetalleDataSec data={data} listAdssPoste={listAdssPoste} /> : <></>}
              </CustomTabComponent>
              <CustomTabComponent value={value} index={1}>
                <PosteDetalleEventoSec posteId={posteId} />
              </CustomTabComponent>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};
export default PosteDetalleSec;
