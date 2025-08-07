import { CategoryName } from "@/constants/icons";

export type HandshakeCollectionData = {
  done: "true" | "false";
};

export type NoteCollectionData = {
  id: string;
  createdAt: number;
  updatedAt: number;
  type: "note" | "todo";
  title: string;
  text: string;
  category: {
    icon: CategoryName;
    index: boolean;
    name: string;
    selected: boolean;
  };
  date: string;
  hidden: boolean;
  important: boolean;
  locked: boolean;
  readOnly: boolean;
};

export type CategoryCollectionData = {
  icon: CategoryName;
  order: number;
  index: boolean;
  name: string;
  selected: boolean;
};

export type ConnectedDeviceCollectionData = {
  uuid: string;
  brand: string;
  modelName: string;
  lastSync: string;
  devicesToSync: string[];
  addCategories: {
    [deviceUuid: string]: CategoryCollectionData[];
  };
  deleteCategories: {
    [deviceUuid: string]: CategoryCollectionData[];
  };
  addNotes: {
    [deviceUuid: string]: NoteCollectionData[];
  };
  deleteNotes: {
    [deviceUuid: string]: NoteCollectionData[];
  };
};
