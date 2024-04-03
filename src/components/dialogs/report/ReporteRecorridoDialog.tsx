import { DocumentScanner } from '@mui/icons-material'
import { AppBar, Button, Dialog, DialogContent, IconButton, Toolbar, Typography } from '@mui/material'
import React, { useContext, useState } from 'react'
import { CiudadInterface, ReporteInterface } from '../../../interfaces/interfaces';
import { SesionContext } from '../../../context/SesionProvider';
import { getReporteGeneral } from '../../../api/reporte.api';
import { url } from '../../../api/url';
import { useSnackbar } from 'notistack';
import { DataGridPremium, GridCloseIcon, GridColDef, GridExceljsProcessInput, GridToolbar } from '@mui/x-data-grid-premium';
import { getCiudad } from '../../../api/Ciudad.api';


const columns: GridColDef[] = [
    {
        field: 'id', headerName: 'Id',
        //renderCell: (params) => { return params.row.poste.lat; },
        valueGetter(_params, row) { return row.id },
    },
    {
        field: 'name', headerName: 'Nombre',
        //renderCell: (params) => { return params.row.poste.lat; },
        valueGetter(_params, row) { return row.name },
    },
    {
        field: 'lat', headerName: 'Latitud',
        //renderCell: (params) => { return params.row.poste.lat; },
        valueGetter(_params, row) { return row.lat },
    },
    {
        field: 'lng', headerName: 'Longitud',
        valueGetter(_params, row) { return row.lng },
    },
    {
        field: 'image', headerName: 'Foto',
        valueGetter(_params, row) {
            return `${url}${row.image}`
        },
        renderCell: (params) => {
            return <img src={`${url}${params.row.image}`} style={{ height: 100 }} />;
        }
    }

];


interface ReporteRecorridoDialogProps {
    filtro: ReporteInterface;

}

const ReporteRecorridoDialog: React.FC<ReporteRecorridoDialogProps> = ({ filtro }) => {

    const [open, setOpen] = useState(false);
    const [list, setList] = useState<CiudadInterface[]>([]);

    const { sesion } = useContext(SesionContext);
    const { enqueueSnackbar } = useSnackbar();




    const handleClickOpen = async () => {
        const TempEvento = await getReporteGeneral(filtro, sesion.token)
        const Temp: CiudadInterface[] = await getCiudad(sesion.token)

        if (TempEvento.length > 0) {
            const TempList: CiudadInterface[] = []
            Temp.map(ciudad => {
                if (ciudad.id === filtro.TramoInicial || ciudad.id === filtro.TramoFinal) {
                    TempList.push(ciudad)

                }
                setList(TempList);

            })
            setOpen(true);
        } else {
            enqueueSnackbar("No hay datos", {
                variant: "warning",
            });
        }
    };

    const handleClose = () => {
        setOpen(false);
    };










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

        for (let i = 5; i <= lastRow; i++) {
            const fila = worksheet.getRow(i);
            fila.height = 15;
        }

        worksheet.mergeCells(1, 1, 1, 5);
        worksheet.mergeCells(2, 1, 2, 5);
        worksheet.mergeCells(3, 1, 3, 5);

        worksheet.getCell('A1').value = 'REPORTE DE RECORRIDO';
        worksheet.getCell('A3').value = 'Lefitel';
        worksheet.getCell('A2').value = filtro.fechaInicial?.toLocaleDateString() + ' - ' + filtro.fechaFinal?.toLocaleDateString();

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
                if (cell.value === "Latitud" || cell.value === "Longitud") {
                    worksheet.getColumn(colNumber).width = 10;
                }

                if (cell.value === true) {
                    cell.value = "1";
                }
            });
        });

        worksheet.getRow(4).eachCell(function (cell) {
            cell.font = {
                bold: true, size: 13, color: { argb: 'ffffff' }
            };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6FA8DC' }
            };
        });

        worksheet.addRow(['Lefitel']);
    };

    const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte de recorrido del " + new Date().toLocaleDateString() };


    return (
        <React.Fragment>
            <Button startIcon={<DocumentScanner />} onClick={handleClickOpen}>
                {"Generar Reporte"}
            </Button>
            <Dialog
                fullScreen
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={handleClose}
                            aria-label="close"
                        >
                            <GridCloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {"Reporte de Recorrido"}
                        </Typography>

                    </Toolbar>
                </AppBar>
                <DialogContent>


                    <DataGridPremium
                        //className="datagrid-content"
                        rows={list ? list : []}
                        columns={columns}
                        slots={{ toolbar: GridToolbar }}
                        hideFooterPagination
                        rowHeight={100}
                        disableRowSelectionOnClick
                        hideFooter
                        slotProps={{ toolbar: { excelOptions } }}

                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    )
}

export default ReporteRecorridoDialog