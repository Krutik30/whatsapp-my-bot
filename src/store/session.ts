import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { BufferJSON, AuthenticationCreds, initAuthCreds, SignalDataTypeMap, proto, SignalKeyStore } from "@whiskeysockets/baileys";
import { logger, prisma } from "../shared";

const fixId = (id: string) => id.replace(/\//g, '__').replace(/:/g, '-');

export async function useSession(sessionId: string) {

  const write = async (data: any, id: string) => {
    try {
      data = JSON.stringify(data, BufferJSON.replacer);
      id = fixId(id);
      await prisma.session.upsert({
        select: { pkId: true },
        create: { data, id, sessionId },
        update: { data },
        where: { sessionId_id: { id, sessionId } },
      });
    } catch (e) {
      logger.error(e, 'An error occurred during session write');
    }
  };

  const read = async (id: string) => {
    try {
      const { data } = await prisma.session.findUniqueOrThrow({
        select: { data: true },
        where: { sessionId_id: { id: fixId(id), sessionId } },
      });
      return JSON.parse(data, BufferJSON.reviver);
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        logger.info({ id }, 'Trying to read non existent session data');
      } else {
        logger.error(e, 'An error occurred during session read');
      }
      return null;
    }
  };

  const del = async (id: string) => {
    try {
      await prisma.session.delete({
        select: { pkId: true },
        where: { sessionId_id: { id: fixId(id), sessionId } },
      });
    } catch (e) {
      logger.error(e, 'An error occurred during session delete');
    }
  };

  const creds: AuthenticationCreds = (await read('creds')) || initAuthCreds();
  const keys: SignalKeyStore = {
    get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
      const data: { [key: string]: SignalDataTypeMap[T] } = {};
      await Promise.all(
        ids.map(async (id) => {
          let value = await read(`${type}-${id}`);
          if (type === 'app-state-sync-key' && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          data[id] = value as SignalDataTypeMap[typeof type];
        })
      );
      return data;
    },
    set: async (data: any) => {
      const tasks: Promise<void>[] = [];

      for (const category in data) {
        for (const id in data[category]) {
          const value = data[category][id];
          const sId = `${category}-${id}`;
          tasks.push(value ? write(value, sId) : del(sId));
        }
      }
      await Promise.all(tasks);
    },
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds: () => write(creds, 'creds'),
  };
}
