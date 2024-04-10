import { useContext, useEffect, useState } from "react";
import {
  Box,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Grid,
} from "@mui/material";
import { EventoInterface, PosteInterface } from "../../interfaces/interfaces";
import { getEvento, searchEvento } from "../../api/Evento.api";
import AddEventoDialog from "../../components/dialogs/add/AddEventoDialog";

import { eventoExample } from "../../data/example";
import EditEventoDialog from "../../components/dialogs/edits/EditEventoDialog";
import { SesionContext } from "../../context/SesionProvider";
import { DataGridPremium, GridColDef, GridRowParams, GridToolbar } from "@mui/x-data-grid-premium";


const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  {
    field: 'poste', headerName: 'poste',
    valueGetter: (value: PosteInterface) => { return value.name; }
  },
  { field: 'description', headerName: 'Descripción' },
  { field: 'state', headerName: 'Estado', type: 'boolean', },
  {
    field: 'createdAt', headerName: 'Creación', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date
    }
  },
];

const EventoPage = () => {
  const [list, setList] = useState<EventoInterface[]>();
  //const [openDelete, setOpenDelete] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [data, setData] = useState<EventoInterface>(eventoExample);
  const { sesion } = useContext(SesionContext);


  useEffect(() => {
    recibirDatos()
  }, [open])
  const recibirDatos = async () => {
    setList(await getEvento(sesion.token))
  }

  const EventoSelect = async (params: GridRowParams) => {
    setOpenEdit(true);
    setData(await searchEvento(params.row.id, sesion.token))
  }

  return (
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        alignItems: "stretch",
      }}
    >
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
        <Card sx={{ flex: 1 }} style={{}}>
          <CardActions >
            <ButtonGroup >
              <AddEventoDialog functionApp={recibirDatos} />
            </ButtonGroup>
          </CardActions>
          <CardContent style={{}}>

            <Box
              sx={{
                height: {
                  xs: "calc(100vh - 105px)",
                  md: "calc(100vh - 200px)",
                },
                width: {
                  xs: "calc(100vw - 110px)",
                  sm: "calc(100vw - 115px)",
                  md: "calc(100vw - 115px)",
                },
              }}
            >
              <DataGridPremium
                //className="datagrid-content"
                rows={list ? list : []}
                columns={columns}
                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
                onRowClick={EventoSelect}
                hideFooter
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {data.id != null ? <EditEventoDialog functionApp={recibirDatos} Evento={data} setEvento={setData} open={openEdit} setOpen={setOpenEdit} /> : null}

    </Grid>
  );
};

export default EventoPage;
