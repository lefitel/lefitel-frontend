import { DocumentScanner } from '@mui/icons-material'
import { AppBar, Button, Dialog, DialogContent, IconButton, Toolbar, Typography } from '@mui/material'
import React, { useContext, useState } from 'react'
import { EventoInterface, ReporteInterface } from '../../../interfaces/interfaces';
import { SesionContext } from '../../../context/SesionProvider';
import { getReporteGeneral } from '../../../api/reporte.api';
import { url } from '../../../api/url';
import { useSnackbar } from 'notistack';
import { DataGridPremium, GridCloseIcon, GridColDef, GridColumnGroupingModel, GridExceljsProcessInput, GridToolbar } from '@mui/x-data-grid-premium';
import axios from 'axios';


const columns: GridColDef[] = [

    {
        field: 'poste', headerName: 'Nmr',
        valueGetter(_params, row) {
            return row.poste.name
        },
    },
    {
        field: 'lat', headerName: 'Latitud',
        //renderCell: (params) => { return params.row.poste.lat; },
        valueGetter(_params, row) { return row.poste.lat },
    },
    {
        field: 'lng', headerName: 'Longitud',
        valueGetter(_params, row) { return row.poste.lng },

    },
    {
        field: 'tramo', headerName: 'Tramo',
        valueGetter(_params, row) { return `${row.poste.ciudadA.name} - ${row.poste.ciudadB.name}` },
    },
    {
        field: 'id', headerName: 'Id',
        valueGetter(params) {
            return params
        },
    },
    {
        field: 'date', headerName: 'Fecha y Hora', type: 'dateTime',
        valueGetter: (value) => {
            const date = new Date(value);
            return date;
        }
    },
    { field: 'description', headerName: 'Descripción' },
    {
        field: 'revicions', headerName: 'Reviciones',
        //renderCell: (params) => { return params.row.revicions.length }
        valueGetter(_params, row) { return row.revicions.length },

    },
    {
        field: 'image', headerName: 'Foto',
        renderCell: (params) => (<img src={`${url}${params.row.image}`} style={{ height: 100 }} />),
        valueGetter(_params, row) { return `${url}${row.image}` },
    },

    {
        field: 'dateSol', headerName: 'Fecha y Hora',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) {
                const date = new Date(row.solucions[0].date);
                return date.toLocaleDateString();
            } else { return "" }
        },

    },
    {
        field: 'descriptionSol', headerName: 'Descripción',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) { return row.solucions[0].description }
            else { return }
        },

    },
    {
        field: 'imageSol', headerName: 'Foto',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) { return `${url}${row.solucions[0].image}` }
            else { return }
        },

        renderCell: (params) => {
            if (params.row.solucions.length > 0) {
                return <img src={`${url}${params.row.solucions[0].image}`} style={{ height: 100 }} />;
            } else { return }
        }
    }
];

const columnGroupingModel: GridColumnGroupingModel = [
    {
        groupId: 'Poste',
        children: [

            { field: 'poste' },
            { field: 'lat' },
            { field: 'lng' },
            { field: 'tramo' },

        ],
    },
    {
        groupId: 'Evento',
        children: [
            { field: 'id' },
            { field: 'image' },
            { field: 'description' },
            { field: 'revicions' },
            { field: 'date' },
        ],
    },
    {
        groupId: 'Solución',
        children: [
            { field: 'imageSol' },
            { field: 'descriptionSol' },

            { field: 'dateSol' },
        ],
    },
];


interface ReporteGeneralDialogProps {
    filtro: ReporteInterface;

}

const ReporteGeneralDialog: React.FC<ReporteGeneralDialogProps> = ({ filtro }) => {

    const [open, setOpen] = useState(false);
    const [list, setList] = useState<EventoInterface[]>([]);

    const { sesion } = useContext(SesionContext);
    const { enqueueSnackbar } = useSnackbar();




    const handleClickOpen = async () => {
        const Temp = await getReporteGeneral(filtro, sesion.token)
        if (Temp.length > 0) {
            setList(Temp),
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

        for (let i = 6; i <= lastRow; i++) {
            const fila = worksheet.getRow(i);
            fila.height = 50;
            const celda = worksheet.getCell(`I${i}`)
            if (celda.value != "" && celda.value != undefined) {
                const imageBuffer = await axios.get(celda.value.toString(), { responseType: 'arraybuffer' });
                const imageId = workbook.addImage({
                    buffer: imageBuffer.data,
                    extension: 'jpeg',
                });
                celda.value = ""
                worksheet.addImage(imageId, `I${i}:I${i}`);

            }


        }


        worksheet.mergeCells(1, 1, 1, 12);
        worksheet.mergeCells(2, 1, 2, 12);
        worksheet.mergeCells(3, 1, 3, 12);

        worksheet.getCell('A1').value = 'REPORTE GENERAL';
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







        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            lastRow = Math.max(lastRow, rowNumber);
            row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
                lastCol = Math.max(lastCol, colNumber);
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true,
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                if (cell.value === "Latitud" || cell.value === "Longitud") {
                    worksheet.getColumn(colNumber).width = 10;
                }


                switch (cell.value) {
                    case 'Poste':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE06666' } // Rojo
                        };
                        break;
                    case 'Evento':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF6FA8DC' } // Rojo
                        }; break;
                    case 'Solución':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFe2ac3f' } // Rojo
                        }; break;

                    default:
                }
                if (cell.value === true) {
                    cell.value = "1";
                }
            });
        });

        worksheet.getRow(4).eachCell(function (cell) {
            cell.font = { bold: true, size: 13, };
        });
        worksheet.getRow(5).eachCell(function (cell) {
            cell.font = { bold: true };
        });



        //worksheet.addRow(['Lefitel']);
    };

    const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte general del " + new Date().toLocaleDateString() };









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
                            {"Reporte General"}
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
                        columnGroupingModel={columnGroupingModel}
                        slotProps={{ toolbar: { excelOptions } }}

                    />
                </DialogContent>
            </Dialog>
        </React.Fragment>
    )
}

export default ReporteGeneralDialog