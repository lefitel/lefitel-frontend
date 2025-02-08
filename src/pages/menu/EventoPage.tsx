import { useContext, useEffect, useState } from "react";
import {
  Box,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Grid,
} from "@mui/material";
import { EventoInterface, EventoObsInterface, PosteInterface, RevicionInterface, UsuarioInterface } from "../../interfaces/interfaces";
import { getEvento } from "../../api/Evento.api";
import AddEventoDialog from "../../components/dialogs/add/AddEventoDialog";

import { eventoExample } from "../../data/example";
import EditEventoDialog from "../../components/dialogs/edits/EditEventoDialog";
import { SesionContext } from "../../context/SesionProvider";
import { DataGridPremium, GridColDef, GridExceljsProcessInput, GridRowParams, GridToolbar } from "@mui/x-data-grid-premium";
import axios from "axios";


const columns: GridColDef[] = [
  {
    field: 'num', headerName: '#',
    renderCell: (params) => {
      // Usa `params.api.getRowIndexRelativeToVisibleRows` para obtener el índice
      const rowIndex = params.api.getRowIndexRelativeToVisibleRows(params.id);
      return <span>{rowIndex + 1}</span>;
    },
  },
  {
    field: 'poste', headerName: 'poste',
    valueGetter: (value: PosteInterface) => { return value.name; }
  },
  {
    field: 'propietario', headerName: 'Propietario',
    valueGetter(_params, row) { return row.poste.propietario.name; }

  },
  {
    field: 'lat', headerName: 'Lat',
    valueGetter(_params, row) { return row.poste.lat }
  },
  {
    field: 'lng', headerName: 'Lng',
    valueGetter(_params, row) { return row.poste.lng }

  },
  { field: 'description', headerName: 'Descripción' },
  {
    field: 'tramo', headerName: 'Tramo',
    valueGetter(_params, row) { return `${row.poste.ciudadA.name} - ${row.poste.ciudadB.name} ` },
  },
  { field: 'state', headerName: 'Estado', type: 'boolean', },
  {
    field: 'usuario', headerName: 'Usuario',
    valueGetter: (value: UsuarioInterface) => { return value ? value.name : ""; }
  },
  {
    field: 'reviciones', headerName: 'Ultima revición', type: 'dateTime',
    valueGetter(_params, row) {

      const reviciones = row.revicions || [];
      // Busca la fecha más reciente en las revisiones
      //@ts-expect-error blabla
      const maxFecha = reviciones.reduce((max, rev) => {
        const fecha = new Date(rev.date);
        return fecha > max ? fecha : max;
      }, new Date(0)); // Fecha inicial muy baja

      return maxFecha;
      /*
      let date
      try { date = new Date(row.revicions[row.revicions.length - 1].date); }
      catch {
        date = null;
      }
      return date;*/
    },
  },
  {
    field: 'revicions', headerName: 'Reviciones',
    valueGetter: (value: RevicionInterface[]) => { return value.length }

    //renderCell: (params) => { return params.row.revicions.length }
    //valueGetter(_params, row) { return row.revicions.length },


  },
  {
    field: 'eventoObs', headerName: 'Observaciones',
    valueGetter: (value: EventoObsInterface[]) => { return value ? ("(" + value.length + ") " + value.map(item => item.ob?.name).join(", ")) : 0 }

    //renderCell: (params) => { return params.row.revicions.length }
    //valueGetter(_params, row) { return row.revicions.length },


  },
  {
    field: 'createdAt', headerName: 'Creación', type: 'date',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', type: 'date',
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
  const [cargando, setCargando] = useState(false);


  useEffect(() => {
    recibirDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const recibirDatos = async () => {
    setList(await getEvento(sesion.token))
  }

  const EventoSelect = async (params: GridRowParams) => {
    setOpenEdit(true);
    console.log(params.row)
    setData(params.row)
    //setData(await searchEvento(params.row.id, sesion.token))
  }




  const exceljsPreProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
    setCargando(true)
    workbook.creator = 'Lefitel';
    workbook.created = new Date();
    worksheet.properties.defaultRowHeight = 30;
    worksheet.getCell("A1").value = ""
    worksheet.addRow([]);
  };

  const exceljsPostProcess = async ({ workbook, worksheet }: GridExceljsProcessInput) => {
    worksheet.addRow({});
    worksheet.name = 'Reporte';

    let lastRow = 0;
    let lastCol = 0;
    worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
      lastRow = Math.max(lastRow, rowNumber);
      row.eachCell({ includeEmpty: true }, function (_cell, colNumber) {
        lastCol = Math.max(lastCol, colNumber);
      });
    });

    for (let i = 4; i <= (lastRow - 1); i++) {
      const fila = worksheet.getRow(i);
      fila.height = 15;
      worksheet.getCell(`A${i}`).value = i - 3;

    }

    const imageBufferTigo = await axios.get("/tigo.png", { responseType: 'arraybuffer' });
    const imageIdTigo = workbook.addImage({
      buffer: imageBufferTigo.data,
      extension: 'png',
    });
    worksheet.addImage(imageIdTigo, `N1:N2`);

    const imageBufferLefitel = await axios.get("/logo.png", { responseType: 'arraybuffer' });
    const imageIdLefitel = workbook.addImage({
      buffer: imageBufferLefitel.data,
      extension: 'png',
    });
    worksheet.addImage(imageIdLefitel, `A1:A2`);

    worksheet.mergeCells(1, 1, 1, 14);
    worksheet.mergeCells(2, 1, 2, 14);

    worksheet.getCell('A1').value = 'EVENTOS';
    worksheet.getCell('A2').value = 'Lefitel';

    worksheet.getCell('A1').font = {
      bold: true,
      size: 36,
    };

    worksheet.getCell('A2').font = {
      bold: true,
      size: 18,
    };

    ['A1', 'A2'].map(key => {
      worksheet.getCell(key).alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
    });

    worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
      lastRow = Math.max(lastRow, rowNumber);
      row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
        lastCol = Math.max(lastCol, colNumber);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        if (cell.value === true) {
          cell.value = "Solucionado";
        } else if (cell.value === false) {
          cell.value = "Pendiente";
        }
      });
    });

    worksheet.getRow(3).eachCell(function (cell) {
      cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF001F5D' }
      }
    });

    //worksheet.addRow(['Lefitel']);
    setCargando(false)
  };

  const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte de eventos del " + new Date().toLocaleDateString() };



  return (
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        alignItems: "stretch",
      }}
    >
      {cargando && (
        <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
          <CircularProgress sx={{ color: "white" }} />
        </Box>
      )}
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>

        <Card sx={{ flex: 1 }} style={{}}>
          {list ? <>
            <CardActions >
              {sesion.usuario.id_rol != 3 ? <>
                <ButtonGroup >
                  <AddEventoDialog functionApp={recibirDatos} />
                </ButtonGroup>
              </> : null}
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
                  rows={list}
                  columns={columns}
                  hideFooterPagination
                  rowHeight={38}
                  disableRowSelectionOnClick
                  slots={{
                    toolbar: GridToolbar,
                  }}
                  onRowClick={EventoSelect}
                  hideFooter
                  /* @ts-expect-error No se sabe el tipo de event */
                  slotProps={{ toolbar: { excelOptions, showQuickFilter: true } }}


                />

              </Box>
            </CardContent>
          </> : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}
        </Card>

      </Grid>

      {data.id != null ? <EditEventoDialog functionApp={recibirDatos} Evento={data} setEvento={setData} open={openEdit} setOpen={setOpenEdit} /> : null}

    </Grid>
  );
};

export default EventoPage;
