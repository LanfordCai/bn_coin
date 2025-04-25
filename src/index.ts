import express, { Request, Response } from 'express';
import axios from 'axios';

interface Network {
    network: string;
    coin: string;
    name: string;
    depositDust: string;
    depositEnable: boolean;
    withdrawEnable: boolean;
    depositHideEnable: boolean;
    withdrawHideEnable: boolean;
    depositDesc: string;
    depositMsgCategoryDesc: string | null;
    withdrawDesc: string;
    withdrawMsgCategoryDesc: string | null;
    specialTips: string;
    specialWithdrawTips: string;
    depositFee: string;
    withdrawFee: string;
    withdrawMin: string;
    estimatedRecoveryTime: number | null;
    estimatedArrivalTime: number;
    country: string;
    label: string;
    busy: boolean;
    contractAddress: string;
}

interface Coin {
    coin: string;
    name: string;
    depositAllEnable: boolean;
    withdrawAllEnable: boolean;
    depositHideAll: boolean;
    withdrawHideAll: boolean;
    logoUrl: string;
    totalAmount: number | null;
    hotFlag: number;
    btcValuation: number | null;
    networkList: Network[];
}

interface ApiResponse {
    code: string;
    message: string | null;
    messageDetail: string | null;
    data: Coin[];
    success: boolean;
}

interface NetworkInfo {
    [key: string]: string; // network code -> network name
}

interface SimplifiedNetwork {
    name: string;
    withdrawEnable: boolean;
    depositEnable: boolean;
}

interface SimplifiedCoin {
    coin: string;
    name: string;
    networks: {
        [key: string]: SimplifiedNetwork;
    };
}

const BINANCE_API_URL = 'https://www.binance.com/bapi/capital/v2/public/capital/getNetworkCoinAll';

async function fetchBinanceData(): Promise<ApiResponse> {
    try {
        const response = await axios.get<ApiResponse>(`${BINANCE_API_URL}?lang=en&ignoreDex=true`);
        return response.data;
    } catch (error) {
        console.error('Error fetching data from Binance:', error);
        throw error;
    }
}

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/api/filter-coins', async (req: Request, res: Response) => {
    try {
        const { networks } = req.body;

        if (!Array.isArray(networks)) {
            return res.status(400).json({
                success: false,
                message: 'Networks must be an array'
            });
        }

        // Fetch data from Binance API
        const binanceResponse = await fetchBinanceData();
        const data = binanceResponse.data;

        // Convert networks array to Set for O(1) lookup
        const whitelistedNetworks = new Set(networks);

        // Filter and transform coins
        const filteredCoins = data
            .filter((coin: Coin) => coin.networkList.some(network => !whitelistedNetworks.has(network.network)))
            .map((coin: Coin): SimplifiedCoin => {
                const networkMap: { [key: string]: SimplifiedNetwork } = {};
                
                coin.networkList.forEach(network => {
                    networkMap[network.network] = {
                        name: network.name,
                        withdrawEnable: network.withdrawEnable,
                        depositEnable: network.depositEnable
                    };
                });

                return {
                    coin: coin.coin,
                    name: coin.name,
                    networks: networkMap
                };
            });

        return res.json({
            success: true,
            total: filteredCoins.length,
            totalCoins: data.length,
            data: filteredCoins
        });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

app.get('/api/networks', async (_req: Request, res: Response) => {
    try {
        const binanceResponse = await fetchBinanceData();
        
        // Create a Map to store network code -> name mapping
        const networksMap: NetworkInfo = {};
        
        // Iterate through all coins and their networks
        binanceResponse.data.forEach((coin: Coin) => {
            coin.networkList.forEach((network: Network) => {
                // Only update if the network name doesn't exist or is shorter
                // This ensures we get the most detailed name when the same network appears multiple times
                if (!networksMap[network.network] || 
                    networksMap[network.network].length < network.name.length) {
                    networksMap[network.network] = network.name;
                }
            });
        });

        // Convert to array and sort by network code
        const sortedNetworks = Object.entries(networksMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .reduce((obj, [key, value]) => ({
                ...obj,
                [key]: value
            }), {});

        return res.json({
            success: true,
            total: Object.keys(networksMap).length,
            data: sortedNetworks
        });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 