import React, { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BackspaceIcon } from "react-native-heroicons/outline";

import { BORDER, COLOR, FONTWEIGHT, SIZE } from "@/constants/styles";

function VirtualNumberKeyboard({ onAdd, onRemove, disabled }) {
  return (
    <View style={styles.keyboard_wrapper}>
      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(1)} disabled={disabled}>
          <Text style={styles.keyboard_text}>1</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(2)} disabled={disabled}>
          <Text style={styles.keyboard_text}>2</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(3)} disabled={disabled}>
          <Text style={styles.keyboard_text}>3</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(4)} disabled={disabled}>
          <Text style={styles.keyboard_text}>4</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(5)} disabled={disabled}>
          <Text style={styles.keyboard_text}>5</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(6)} disabled={disabled}>
          <Text style={styles.keyboard_text}>6</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(7)} disabled={disabled}>
          <Text style={styles.keyboard_text}>7</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(8)} disabled={disabled}>
          <Text style={styles.keyboard_text}>8</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(9)} disabled={disabled}>
          <Text style={styles.keyboard_text}>9</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} disabled>
          <Text style={styles.keyboard_text} />
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onAdd(0)} disabled={disabled}>
          <Text style={styles.keyboard_text}>0</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.keyboard_input_wrapper}>
        <TouchableOpacity delayPressIn={0} style={styles.keyboard_input} onPress={onRemove} disabled={disabled}>
          <BackspaceIcon size={38} color={COLOR.softWhite} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard_wrapper: {
    borderTopLeftRadius: BORDER.normal,
    borderTopRightRadius: BORDER.normal,
    overflow: "hidden",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  keyboard_input_wrapper: {
    width: SIZE.third,
    height: 80,
    borderWidth: 0.5,
    borderColor: COLOR.darkBlue,
  },
  keyboard_input: {
    height: SIZE.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.blue,
  },
  keyboard_text: {
    color: COLOR.softWhite,
    fontWeight: FONTWEIGHT.semiBold,
    fontSize: 42,
  },
});

export default memo(VirtualNumberKeyboard);
