const fs = require("fs/promises");
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const classesToExtract = [
    "com.ankamagames.dofus.network.MessageReceiver",
    "com.ankamagames.dofus.network.ProtocolTypeManager",
];

const messagesTypesRegex = "_messagesTypes[[0-9]*] = [A-Za-z]*;";
const typesTypesRegex = "_typesTypes[[0-9]*] = [A-Za-z]*;";

const main = async () => {
    console.log("cleaning");
    await exec("rm -rf ./output/*");
    await exec("rm -rf ./dist/*");
    await exec("rm -rf ./pydofus/input/*");
    await exec("rm -rf ./pydofus/output/*");

    console.log("copying DofusInvoker.swf, items and translations");
    await exec(`cp /home/martin/.config/Ankama/Dofus/DofusInvoker.swf ./`);

    await makeTranslations();
    await makeItems();

    await exec(`rm ./pydofus/output/Items.json`);
    await exec(`mv ./pydofus/output/* ./output/`);

    console.log(
        "extracting",
        classesToExtract.map((classe) => classe.split(".")[4])
    );
    await exec(
        `ffdec -selectclass ${classesToExtract.join(",")} -export script "dist" DofusInvoker.swf`
    );

    console.log("extracted in dist folder");

    const messageReceiver = await messageReceiverToJson(
        "./dist/scripts/" + classesToExtract[0].split(".").join("/") + ".as"
    );
    await fs.writeFile(
        path.join(__dirname, "output", "messageReceiver.json"),
        JSON.stringify(messageReceiver, null, 4)
    );

    const protocolTypeManager = await protocolTypeManagerToJson(
        "./dist/scripts/" + classesToExtract[1].split(".").join("/") + ".as"
    );
    await fs.writeFile(
        path.join(__dirname, "output", "protocolTypeManager.json"),
        JSON.stringify(protocolTypeManager, null, 4)
    );

    console.log("done, cleaning extracted files");
    await exec("rm -rf ./dist/*");
    await exec("rm -rf ./pydofus/output/*");
    await exec("rm -rf ./pydofus/input/*");
};

main();

const makeTranslations = async () => {
    await exec(`cp /home/martin/.config/Ankama/Dofus/data/i18n/i18n_fr.d2i ./pydofus/input`);
    console.log("converting d2i to json");
    await exec(`cd ./pydofus && python3 d2i_unpack.py ./input/i18n_fr.d2i`);
    await exec("mv ./pydofus/input/i18n_fr.json ./pydofus/output/i18n_fr.json ");
};

const makeItems = async () => {
    await exec(`cp /home/martin/.config/Ankama/Dofus/data/common/Items.d2o ./pydofus/input`);

    console.log("converting d2o to json");
    await exec(`cd ./pydofus && python3 d2o_unpack.py`);

    await loadTranslations();
    const itemsRaw = await fs.readFile("./pydofus/output/Items.json", "utf-8");
    const items = JSON.parse(itemsRaw.split("NaN").join(-1)).map((item) => ({
        name: getStringByNameId(String(item.nameId)),
        nameId: item.nameId,
        id: item.id,
    }));
    console.log("writing item.min.json");
    await fs.writeFile("./pydofus/output/item.min.json", JSON.stringify(items, null, 4));
};

const messageReceiverToJson = async (path) => {
    const { stdout } = await exec(`grep '${messagesTypesRegex}' ${path}`);
    const obj = {};
    stdout
        .split("\r")
        .map((str) => str.replace("\n", "").replace("         ", ""))
        .forEach((str) => {
            const [key, value] = str.split(" = ");
            if (!key || !value) return;
            obj[key.replace("_messagesTypes[", "").replace("]", "")] = value.replace(";", "");
        });

    return obj;
};

const protocolTypeManagerToJson = async (path) => {
    const { stdout } = await exec(`grep '${typesTypesRegex}' ${path}`);
    const obj = {};
    stdout
        .split("\r")
        .map((str) => str.replace("\n", "").replace("         ", ""))
        .forEach((str) => {
            const [key, value] = str.split(" = ");
            if (!key || !value) return;
            obj[key.replace("_typesTypes[", "").replace("]", "")] = value.replace(";", "");
        });

    return obj;
};

const translations = {
    current: null,
};

const loadTranslations = async () => {
    if (translations.current) return;
    const raw = await fs.readFile("./pydofus/output/i18n_fr.json", "utf-8");
    translations.current = JSON.parse(raw).texts;
};
const getStringByNameId = (nameId) => {
    return translations.current[nameId];
};
