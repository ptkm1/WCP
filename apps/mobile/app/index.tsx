import { Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f1e8",
        padding: 24
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 8 }}>
        Work Context Platform
      </Text>
      <Text style={{ textAlign: "center", color: "#4a3d30" }}>
        Bootstrap mobile do MVP para captura e consulta de contexto.
      </Text>
    </View>
  );
}
