module.exports = {
        apps: [
                {
                        name: "binance_node",
                        script: "./dist/binance_node",
                        error_file: "../../logs/binance_node_err",
                        out_file: "../../logs/binance_node_out",
                        //			instances: 8,
                        //			exec_mode: "cluster",
                        combine_logs: "false",
                        log_date_format: "YYYY-MM-DD_HH-mm-ss",
                },
        ],
};
