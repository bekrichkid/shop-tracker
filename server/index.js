import "dotenv/config";
import { app } from "./app.js";

const PORT = process.env.PORT || 4100;
app.listen(PORT, () => {
  console.log(`Server ${PORT}-portda ishga tushdi -> http://localhost:${PORT}`);
});
