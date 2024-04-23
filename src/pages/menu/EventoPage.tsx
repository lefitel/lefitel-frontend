import { useContext, useEffect, useState } from "react";
import {
  Box,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Grid,
} from "@mui/material";
import { EventoInterface, PosteInterface, UsuarioInterface } from "../../interfaces/interfaces";
import { getEvento, searchEvento } from "../../api/Evento.api";
import AddEventoDialog from "../../components/dialogs/add/AddEventoDialog";

import { eventoExample } from "../../data/example";
import EditEventoDialog from "../../components/dialogs/edits/EditEventoDialog";
import { SesionContext } from "../../context/SesionProvider";
import { DataGridPremium, GridColDef, GridExceljsProcessInput, GridRowParams, GridToolbar } from "@mui/x-data-grid-premium";


const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  {
    field: 'poste', headerName: 'poste',
    valueGetter: (value: PosteInterface) => { return value.name; }
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
  /*{
      field: 'reviciones', headerName: 'Ultima Revición',
      valueGetter(_params, row) {
        //console.log(row); 
        return `${row.revicions.pop()}`
      },
    },*/
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




  const exceljsPreProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
    workbook.creator = 'Lefitel';
    workbook.created = new Date();
    worksheet.properties.defaultRowHeight = 30;
    worksheet.getCell("A2").value = ""


    worksheet.addRow([]);
  };
  const exceljsPostProcess = ({ worksheet }: GridExceljsProcessInput) => {
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

    for (let i = 6; i <= lastRow; i++) {
      const fila = worksheet.getRow(i);
      fila.height = 15;
    }

    worksheet.mergeCells(1, 1, 1, 6);
    worksheet.mergeCells(2, 1, 2, 6);
    worksheet.mergeCells(3, 1, 3, 6);

    worksheet.getCell('A1').value = 'EVENTOS';
    worksheet.getCell('A2').value = 'Lefitel';

    ['A2', 'A3'].map(key => {
      worksheet.getCell(key).font = {
        bold: true,
        size: 15,
      };
    });


    worksheet.getCell('A1').font = {
      bold: true,
      size: 20,
    };
    ['A1', 'A2', 'A3'].map(key => {
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

    worksheet.getRow(4).eachCell(function (cell) {
      cell.font = { bold: true, size: 13, };
    });


    //worksheet.addRow(['Lefitel']);
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
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
        <Card sx={{ flex: 1 }} style={{}}>
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
                rows={list ? list : []}
                columns={columns}
                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                }}
                onRowClick={EventoSelect}
                hideFooter
                slotProps={{ toolbar: { excelOptions, showQuickFilter: true } }}

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
