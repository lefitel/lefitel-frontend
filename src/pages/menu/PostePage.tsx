import { useContext, useEffect, useState } from "react";
import {
  Box,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Grid
} from "@mui/material";
import { CiudadInterface, MaterialInterface, PosteInterface, PropietarioInterface } from "../../interfaces/interfaces";
import { getPoste, searchPoste } from "../../api/Poste.api";
import AddPosteDialog from "../../components/dialogs/add/AddPosteDialog";

import { posteExample } from "../../data/example";
import EditPosteDialog from "../../components/dialogs/edits/EditPosteDialog";
import { SesionContext } from "../../context/SesionProvider";
import { DataGridPremium, GridColDef, GridExceljsProcessInput, GridRowParams, GridToolbar } from "@mui/x-data-grid-premium";


const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Número' },
  { field: 'lat', headerName: 'Lat' },
  { field: 'lng', headerName: 'Lng' },
  {
    field: 'material', headerName: 'Material',
    //type: 'singleSelect', valueOptions: ['full time', 'part time', 'intern'],
    valueGetter: (value: MaterialInterface) => { return value.name }
  },
  {
    field: 'propietario', headerName: 'Propietario',
    valueGetter: (value: PropietarioInterface) => { return value.name }
  },
  {
    field: 'ciudadA', headerName: 'Tramo de Inicio',
    valueGetter: (value: CiudadInterface) => { return value.name }
  },
  {
    field: 'ciudadB', headerName: 'Tramo de Fin',
    valueGetter: (value: CiudadInterface) => { return value.name }
  },
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
      return date;
    }
  },
];


















const PostePage = () => {
  const [list, setList] = useState<PosteInterface[]>([]);
  //const [openDelete, setOpenDelete] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [data, setData] = useState<PosteInterface>(posteExample);
  const { sesion } = useContext(SesionContext);


  useEffect(() => {
    recibirDatos()
  }, [openEdit])

  const recibirDatos = async () => {
    setList(await getPoste(sesion.token))
  }

  const posteSelect = async (params: GridRowParams) => {
    setOpenEdit(true);
    setData(await searchPoste(params.row.id, sesion.token))
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

    worksheet.mergeCells(1, 1, 1, 10);
    worksheet.mergeCells(2, 1, 2, 10);
    worksheet.mergeCells(3, 1, 3, 10);

    worksheet.getCell('A1').value = 'POSTES';
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
      });
    });

    worksheet.getRow(4).eachCell(function (cell) {
      cell.font = { bold: true, size: 13, };
    });


    //worksheet.addRow(['Lefitel']);
  };

  const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte de postes del " + new Date().toLocaleDateString() };



  return (
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        alignItems: "stretch",
      }}
    >
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
        <Card sx={{ flex: 1 }} >
          <CardActions >
            <ButtonGroup >
              <AddPosteDialog functionApp={recibirDatos} />
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
                onRowClick={posteSelect}
                hideFooter
                slotProps={{ toolbar: { excelOptions, showQuickFilter: true } }}

              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      {data.id != null ? <EditPosteDialog functionApp={recibirDatos} poste={data} setPoste={setData} open={openEdit} setOpen={setOpenEdit} /> : null}

    </Grid>
  );
};

export default PostePage;
